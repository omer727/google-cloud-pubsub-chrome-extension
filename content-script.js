// GCP Pub/Sub Message Memory content script (MV3)
// Saves last message per topic and prefills when the publish modal opens

(function () {
  const GLOBAL_STORAGE_KEY = 'gcp_pubsub_last_message:global';
  const GLOBAL_ATTRS_KEY = 'gcp_pubsub_last_attributes:global';
  const TOPIC_REGEX = /\/cloudpubsub\/topic\/detail\/([^\/?#]+)/;
  let modalPollTimer = null;
  let modalPollStopTimer = null;

  function getCurrentTopic() {
    try {
      const match = String(window.location.pathname).match(TOPIC_REGEX);
      return match && match[1] ? decodeURIComponent(match[1]) : null;
    } catch (_) {
      return null;
    }
  }

  function getTopicKey(topic) {
    return topic ? `gcp_pubsub_last_message:${topic}` : GLOBAL_STORAGE_KEY;
  }

  function getTopicAttrsKey(topic) {
    return topic ? `gcp_pubsub_last_attributes:${topic}` : GLOBAL_ATTRS_KEY;
  }

  function loadLastMessage(topic) {
    const key = getTopicKey(topic);
    return new Promise((resolve) => {
      chrome.storage.local.get([key, GLOBAL_STORAGE_KEY], (data) => {
        resolve(
          (data && (data[key] || data[GLOBAL_STORAGE_KEY])) || ''
        );
      });
    });
  }

  function saveLastMessage(topic, text) {
    const key = getTopicKey(topic);
    const payload = {};
    payload[key] = text;
    payload[GLOBAL_STORAGE_KEY] = text;
    try {
      chrome.storage.local.set(payload, () => {});
    } catch (_) {
      // no-op
    }
  }

  function loadLastAttributes(topic) {
    const key = getTopicAttrsKey(topic);
    return new Promise((resolve) => {
      chrome.storage.local.get([key, GLOBAL_ATTRS_KEY], (data) => {
        resolve((data && (data[key] || data[GLOBAL_ATTRS_KEY])) || {});
      });
    });
  }

  function saveLastAttributes(topic, attrsObj) {
    const key = getTopicAttrsKey(topic);
    const payload = {};
    payload[key] = attrsObj || {};
    payload[GLOBAL_ATTRS_KEY] = attrsObj || {};
    try {
      chrome.storage.local.set(payload, () => {});
    } catch (_) {
      // no-op
    }
  }

  function findMessageInputIn(root) {
    if (!root || !(root instanceof Element)) return null;

    // Prefer textareas
    const textareas = root.querySelectorAll('textarea');
    if (textareas && textareas.length) {
      // Try to find one that looks like a message body
      for (const ta of textareas) {
        const placeholder = (ta.getAttribute('placeholder') || '').toLowerCase();
        if (placeholder.includes('message')) return ta;
      }
      return textareas[0];
    }

    // Contenteditable editors
    const editable = root.querySelector('[contenteditable="true"]');
    if (editable) return editable;

    // Monaco editor hidden textarea (best-effort)
    const monaco = root.querySelector('.monaco-editor');
    if (monaco) {
      const hiddenInput = monaco.querySelector('textarea.inputarea');
      if (hiddenInput) return hiddenInput;
    }

    // Fallback to a general input
    const input = root.querySelector('input[type="text"], input');
    return input || null;
  }

  function findPublishButtonIn(root) {
    if (!root || !(root instanceof Element)) return null;
    const candidates = root.querySelectorAll('button, [role="button"]');
    for (const el of candidates) {
      const txt = (el.textContent || '').trim().toLowerCase();
      if (!txt) continue;
      if (txt === 'publish' || txt.includes('publish')) return el;
    }
    return null;
  }

  function getElementValue(el) {
    if (!el) return '';
    if ('value' in el) return el.value;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
      return el.innerText || '';
    }
    return (el.textContent || '').trim();
  }

  function setElementValue(el, value) {
    if (!el) return;
    if ('value' in el) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
      el.innerText = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function ensurePrefill(input, topic) {
    if (!input) return;
    loadLastMessage(topic).then((last) => {
      const current = getElementValue(input);
      if (last && (!current || !current.trim())) {
        setElementValue(input, last);
      }
    });
  }

  function getLowerLabelForInput(inputEl) {
    if (!inputEl) return '';
    const attrs = (name) => (inputEl.getAttribute(name) || '').toLowerCase();
    let label = attrs('placeholder') || attrs('aria-label');
    if (!label) {
      const id = inputEl.getAttribute('id');
      if (id) {
        try {
          const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (lbl && lbl.textContent) label = lbl.textContent.toLowerCase();
        } catch (_) {}
      }
    }
    return label || '';
  }

  function findAttributeRowsIn(root) {
    if (!root || !(root instanceof Element)) return { rows: [], addButton: null };

    // Primary strategy: each row is a cfc-form-stack-row containing both inputs
    const rowEls = root.querySelectorAll('cfc-form-stack-row');
    const rows = [];
    for (const row of rowEls) {
      const keyEl = row.querySelector('input.cps-attribute-key-input, input[formcontrolname="key"]');
      const valueEl = row.querySelector('input.cps-attribute-value-input, input[formcontrolname="value"]');
      if (keyEl && valueEl) {
        rows.push({ keyEl, valueEl });
      }
    }

    // Fallback strategy: heuristic pairing by label proximity
    if (rows.length === 0) {
      const inputs = root.querySelectorAll('input');
      const keyCandidates = [];
      const valueCandidates = [];
      for (const input of inputs) {
        const label = getLowerLabelForInput(input);
        if (!label) continue;
        const isKey = label.includes('key') || (label.includes('attribute') && label.includes('name'));
        const isValue = label.includes('value') || (label.includes('attribute') && label.includes('value'));
        if (isKey) keyCandidates.push(input);
        if (isValue) valueCandidates.push(input);
      }

      function sharesAncestorWithinDepth(a, b, depth) {
        if (!a || !b) return false;
        let ancestor = a;
        for (let i = 0; i < depth && ancestor; i++) {
          const currentAncestor = ancestor;
          let node = b;
          for (let j = 0; j < depth && node; j++) {
            if (node === currentAncestor) return true;
            node = node.parentElement;
          }
          ancestor = ancestor.parentElement;
        }
        return false;
      }

      for (const keyEl of keyCandidates) {
        let bestValue = null;
        for (const valEl of valueCandidates) {
          if (sharesAncestorWithinDepth(keyEl, valEl, 4)) {
            bestValue = valEl;
            break;
          }
        }
        if (bestValue) rows.push({ keyEl, valueEl: bestValue });
      }
    }

    let addButton = null;
    const btns = root.querySelectorAll('button, [role="button"]');
    for (const b of btns) {
      const text = (b.textContent || '').toLowerCase();
      const aria = (b.getAttribute && (b.getAttribute('aria-label') || '')).toLowerCase();
      if (
        (text && (text.includes('add attribute') || (text.includes('add') && text.includes('attribute')))) ||
        (aria && aria.includes('add attribute'))
      ) {
        addButton = b;
        break;
      }
    }

    return { rows, addButton };
  }

  function readAttributesFrom(root) {
    const { rows } = findAttributeRowsIn(root);
    const result = {};
    for (const { keyEl, valueEl } of rows) {
      const k = (getElementValue(keyEl) || '').trim();
      const v = (getElementValue(valueEl) || '').trim();
      if (k) result[k] = v;
    }
    return result;
  }

  function ensurePrefillAttributes(root, topic) {
    loadLastAttributes(topic).then((attrs) => {
      if (!attrs || Object.keys(attrs).length === 0) return;
      const fill = () => {
        const { rows, addButton } = findAttributeRowsIn(root);
        const totalRows = rows.length;
        const pairsNeeded = Object.keys(attrs).length;
        const needed = Math.max(0, pairsNeeded - totalRows);
        if (needed > 0 && addButton) {
          for (let i = 0; i < needed; i++) {
            try { addButton.click(); } catch (_) {}
          }
          setTimeout(fill, 250);
          return;
        }
        const pairs = Object.entries(attrs);
        let i = 0;
        for (const row of rows) {
          if (i >= pairs.length) break;
          const haveKey = (getElementValue(row.keyEl) || '').trim();
          const haveVal = (getElementValue(row.valueEl) || '').trim();
          if (!haveKey && !haveVal) {
            const [k, v] = pairs[i++];
            setElementValue(row.keyEl, k);
            setElementValue(row.valueEl, v);
          }
        }
      };
      fill();
    });
  }

  function findPublishDialog() {
    // Look for dialogs or overlays that contain a message input and a publish button
    const roots = [
      ...document.querySelectorAll('[role="dialog"], dialog, .cdk-overlay-container, .cdk-overlay-pane')
    ];
    for (const root of roots) {
      const input = findMessageInputIn(root);
      const publishBtn = findPublishButtonIn(root);
      if (input && publishBtn) return { root, input, publishBtn };
    }
    return null;
  }

  function wireUpPublishModalIfPresent() {
    const found = findPublishDialog();
    if (!found) return false;
    const { root, input, publishBtn } = found;

    const topic = getCurrentTopic();
    // Always attempt a safe prefill if the field is empty
    ensurePrefill(input, topic);
    ensurePrefillAttributes(root, topic);

    // Avoid double-wiring only for event listeners
    if (!(root && root.__psWired)) {
      try { root.__psWired = true; } catch (_) {}

      const onRootClick = (event) => {
        try {
          const target = event.target;
          if (!target) return;
          const btn = (typeof target.closest === 'function') ? target.closest('button, [role="button"]') : null;
          if (!btn) return;
          const txt = (btn.textContent || '').trim().toLowerCase();
          const aria = (btn.getAttribute && (btn.getAttribute('aria-label') || '').toLowerCase()) || '';
          const isPublish = (txt && txt.includes('publish')) || (aria && aria.includes('publish'));
          if (!isPublish) return;

          const latestRoot = root.isConnected ? root : document;
          const latestInput = findMessageInputIn(latestRoot) || input;
          const messageText = (getElementValue(latestInput) || '').trim();
          if (messageText) {
            saveLastMessage(topic, messageText);
          }
          const attrs = readAttributesFrom(latestRoot);
          saveLastAttributes(topic, attrs);

          // After publish, UI may clear or re-render; re-prefill shortly after
          setTimeout(() => {
            const refreshedRoot = root.isConnected ? root : document;
            const refreshedInput = findMessageInputIn(refreshedRoot) || latestInput;
            ensurePrefill(refreshedInput, topic);
            ensurePrefillAttributes(refreshedRoot, topic);
          }, 250);
        } catch (_) {}
      };

      try {
        root.addEventListener('click', onRootClick, true);
      } catch (_) {}
    }
    return true;
  }

  function hasPublishModalParam() {
    try {
      const href = (window.location && window.location.href ? window.location.href : '').toLowerCase();
      if (href.includes('modal=publishmessage')) return true;

      const params = new URLSearchParams(window.location.search || '');
      if ((params.get('modal') || '').toLowerCase() === 'publishmessage') return true;

      const hash = window.location.hash || '';
      if (hash) {
        const qIndex = hash.indexOf('?');
        if (qIndex >= 0) {
          const qs = hash.slice(qIndex + 1);
          if (qs) {
            const hashParams = new URLSearchParams(qs);
            if ((hashParams.get('modal') || '').toLowerCase() === 'publishmessage') return true;
          }
        }
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  function stopModalPolling() {
    if (modalPollTimer) {
      clearInterval(modalPollTimer);
      modalPollTimer = null;
    }
    if (modalPollStopTimer) {
      clearTimeout(modalPollStopTimer);
      modalPollStopTimer = null;
    }
  }

  function startModalPolling(force) {
    stopModalPolling();
    if (!force && !hasPublishModalParam()) return;
    // Poll briefly for the modal to render, then wire it once
    modalPollTimer = setInterval(() => {
      const wired = wireUpPublishModalIfPresent();
      if (wired) {
        stopModalPolling();
      }
    }, 200);
    // Safety stop after 6 seconds
    modalPollStopTimer = setTimeout(() => {
      stopModalPolling();
    }, 6000);
  }

  function startModalPollingIfNeeded() {
    startModalPolling(false);
  }

  // Hook into history navigation (SPA route changes)
  function hookHistory() {
    try {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      history.pushState = function () {
        const result = originalPushState.apply(this, arguments);
        setTimeout(startModalPollingIfNeeded, 0);
        return result;
      };
      history.replaceState = function () {
        const result = originalReplaceState.apply(this, arguments);
        setTimeout(startModalPollingIfNeeded, 0);
        return result;
      };
    } catch (_) {}

    window.addEventListener('popstate', () => {
      setTimeout(startModalPollingIfNeeded, 0);
    });
    window.addEventListener('hashchange', () => {
      setTimeout(startModalPollingIfNeeded, 0);
    });
  }

  function isPublishTriggerButton(el) {
    if (!el) return false;
    const txt = (el.textContent || '').trim().toLowerCase();
    const aria = (el.getAttribute && (el.getAttribute('aria-label') || '').toLowerCase()) || '';
    // Page-level trigger usually says "Publish message"
    if ((txt && txt.includes('publish message')) || (aria && aria.includes('publish message'))) return true;
    return false;
  }

  function hookPublishTriggerClicks() {
    const onDocClick = (event) => {
      try {
        const target = event.target;
        if (!target) return;
        const btn = (typeof target.closest === 'function') ? target.closest('button, [role="button"]') : null;
        if (!btn) return;
        if (!isPublishTriggerButton(btn)) return;
        // Start an unconditional modal poll since URL param may not change
        setTimeout(() => startModalPolling(true), 0);
      } catch (_) {}
    };
    try {
      document.addEventListener('click', onDocClick, true);
    } catch (_) {}
  }

  // Kickoff
  startModalPollingIfNeeded();
//   hookHistory();
  hookPublishTriggerClicks();
})();


