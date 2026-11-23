(function () {
  'use strict';

  // Theme -------------------------------------------------------------------
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('uatdesk.theme'); } catch (e) { /* storage blocked */ }
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }

  document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('uatdesk.theme', next); } catch (e) { /* ignore */ }
    });
  });

  // Flash -------------------------------------------------------------------
  document.querySelectorAll('[data-dismiss]').forEach(function (button) {
    button.addEventListener('click', function () {
      var bar = button.closest('.flashbar');
      if (bar) bar.remove();
    });
  });
  var flash = document.querySelector('.flashbar');
  if (flash) setTimeout(function () { flash.remove(); }, 8000);

  // Copy buttons ------------------------------------------------------------
  document.querySelectorAll('[data-copy-target]').forEach(function (button) {
    button.addEventListener('click', function () {
      var target = document.querySelector(button.getAttribute('data-copy-target'));
      if (!target) return;
      var text = 'value' in target ? target.value : target.textContent;
      var done = function () {
        var old = button.textContent;
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = old; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { selectAndCopy(target, done); });
      } else {
        selectAndCopy(target, done);
      }
    });
  });

  function selectAndCopy(target, done) {
    try {
      if ('select' in target) { target.select(); document.execCommand('copy'); done(); }
    } catch (e) { /* ignore */ }
  }

  // Mode panels -------------------------------------------------------------
  document.querySelectorAll('[data-mode-block]').forEach(function (block) {
    var radios = block.querySelectorAll('[data-mode-group] input[type="radio"]');
    var panels = block.querySelectorAll('[data-mode-panel]');
    function sync() {
      var value = '';
      radios.forEach(function (r) { if (r.checked) value = r.value; });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-mode-panel') !== value;
      });
    }
    radios.forEach(function (r) { r.addEventListener('change', sync); });
    sync();
  });

  // Signature mode ----------------------------------------------------------
  document.querySelectorAll('[data-sig-group]').forEach(function (group) {
    var radios = group.querySelectorAll('input[type="radio"]');
    var panels = document.querySelectorAll('[data-sig-panel]');
    function sync() {
      var value = 'drawn';
      radios.forEach(function (r) { if (r.checked) value = r.value; });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-sig-panel') !== value;
      });
    }
    radios.forEach(function (r) { r.addEventListener('change', sync); });
    sync();
  });

  // Signature pad -----------------------------------------------------------
  var canvas = document.getElementById('sigpad');
  var signatureInput = document.getElementById('signature-data');
  if (canvas && signatureInput) {
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var dirty = false;
    var last = null;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var ratio = Math.max(window.devicePixelRatio || 1, 1);
      var snapshot = dirty ? canvas.toDataURL('image/png') : null;
      canvas.width = Math.max(600, Math.round(rect.width * ratio));
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#14213d';
      if (snapshot) {
        var img = new Image();
        img.onload = function () { ctx.drawImage(img, 0, 0, rect.width, rect.height); };
        img.src = snapshot;
      }
    }

    function point(event) {
      var rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function start(event) {
      drawing = true;
      dirty = true;
      last = point(event);
      canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
    function move(event) {
      if (!drawing) return;
      var p = point(event);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      event.preventDefault();
    }
    function end(event) {
      if (!drawing) return;
      drawing = false;
      signatureInput.value = canvas.toDataURL('image/png');
      canvas.closest('.sigpad-wrap').classList.add('signed');
      if (event) event.preventDefault();
    }

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);
    canvas.addEventListener('pointercancel', end);

    var clear = document.querySelector('[data-sig-clear]');
    if (clear) {
      clear.addEventListener('click', function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dirty = false;
        signatureInput.value = '';
        canvas.closest('.sigpad-wrap').classList.remove('signed');
      });
    }

    window.addEventListener('resize', resize);
    resize();

    var form = document.getElementById('signoff-form');
    if (form) {
      form.addEventListener('submit', function () {
        var kind = form.querySelector('input[name="signatureKind"]:checked');
        if (kind && kind.value === 'drawn' && dirty) {
          signatureInput.value = canvas.toDataURL('image/png');
        }
      });
    }
  }

  // Lightbox ---------------------------------------------------------------
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = lightbox ? lightbox.querySelector('img') : null;
  document.querySelectorAll('[data-lightbox]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!lightbox || !lightboxImg) return;
      lightboxImg.src = button.getAttribute('data-lightbox');
      lightbox.hidden = false;
    });
  });
  if (lightbox) {
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox || event.target.hasAttribute('data-lightbox-close')) lightbox.hidden = true;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') lightbox.hidden = true;
    });
  }

  // Confirm + print ---------------------------------------------------------
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!window.confirm(form.getAttribute('data-confirm'))) event.preventDefault();
    });
  });

  document.querySelectorAll('[data-print]').forEach(function (button) {
    button.addEventListener('click', function () { window.print(); });
  });

  // Avoid double submits ----------------------------------------------------
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (form.getAttribute('data-auto-save') === '1') {
        event.preventDefault();
        return;
      }
      if (event.defaultPrevented) return;
      if (form.checkValidity && !form.checkValidity()) return;
      var buttons = form.querySelectorAll('button[type="submit"]');
      setTimeout(function () {
        buttons.forEach(function (b) { b.disabled = true; });
      }, 0);
    });
  });

  // Auto-save checklist results ---------------------------------------------
  document.querySelectorAll('form[data-auto-save="1"]').forEach(function (form) {
    var csrfInput = form.querySelector('input[name="_csrf"]');
    var radios = form.querySelectorAll('input[name="status"]');
    var comment = form.querySelector('textarea[name="comment"]');
    var statusSpan = document.querySelector('.save-status[data-item-id="' + form.getAttribute('data-item-id') + '"]');
    var debounceTimer = null;
    var clearTimer = null;
    var isSaving = false;
    var pendingSave = false;

    function setStatus(text, color, autoClear) {
      if (!statusSpan) return;
      if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
      statusSpan.textContent = text;
      statusSpan.style.color = color || 'inherit';
      if (autoClear) {
        clearTimer = setTimeout(function () {
          statusSpan.textContent = '';
        }, autoClear);
      }
    }

    function getSelectedRadio() {
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) return radios[i];
      }
      return null;
    }

    function doSave() {
      var selected = getSelectedRadio();
      if (!selected) return;

      var statusValue = selected.value;
      var commentValue = comment ? comment.value.trim() : '';

      if (statusValue === 'fail' && !commentValue) {
        setStatus('Add note to save fail', '#b43a32', 4000);
        if (comment) comment.focus();
        return;
      }

      if (isSaving) {
        pendingSave = true;
        return;
      }

      isSaving = true;
      setStatus('Saving...', '#58625D');

      var tokenVal = csrfInput ? csrfInput.value : '';
      var params = new URLSearchParams();
      params.append('_csrf', tokenVal);
      params.append('status', statusValue);
      params.append('comment', comment ? comment.value : '');

      fetch(form.action, {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': tokenVal,
          'Accept': 'application/json'
        }
      }).then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, status: response.status, data: data };
        }).catch(function () {
          return { ok: response.ok, status: response.status, data: null };
        });
      }).then(function (result) {
        isSaving = false;
        if (result.ok) {
          setStatus('Saved ✓', '#226a4b', 2000);
          var itemId = form.getAttribute('data-item-id');
          var badge = document.querySelector('[data-badge-item="' + itemId + '"]');
          if (badge) {
            if (statusValue === 'pass') {
              badge.className = 'badge b-pass';
              badge.textContent = 'Passed';
            } else if (statusValue === 'fail') {
              badge.className = 'badge b-fail';
              badge.textContent = 'Failed';
            } else if (statusValue === 'na') {
              badge.className = 'badge';
              badge.textContent = 'Not applicable';
            }
          }
          if (pendingSave) {
            pendingSave = false;
            doSave();
          }
        } else {
          var errMsg = (result.data && result.data.error) ? result.data.error : 'Save failed';
          if (result.status === 403) {
            errMsg = 'Session expired. Reload page.';
          }
          setStatus(errMsg, '#b43a32', 4000);
        }
      }).catch(function () {
        isSaving = false;
        setStatus('Network error', '#b43a32', 3000);
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (debounceTimer) clearTimeout(debounceTimer);
      doSave();
    });

    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        doSave();
      });
    });

    if (comment) {
      comment.addEventListener('blur', function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        var selected = getSelectedRadio();
        if (selected) {
          doSave();
        }
      });

      comment.addEventListener('input', function () {
        var selected = getSelectedRadio();
        if (!selected) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          doSave();
        }, 800);
      });
    }
  });

  // Demo fill buttons --------------------------------------------------------
  document.querySelectorAll('.demo-fill-btn').forEach(function (button) {
    button.addEventListener('click', function () {
      var tokenInput = document.getElementById('token-input');
      var passwordInput = document.getElementById('password-input');
      if (tokenInput) tokenInput.value = button.getAttribute('data-token');
      if (passwordInput) passwordInput.value = button.getAttribute('data-pw');
      if (passwordInput) passwordInput.focus();
    });
  });
})();
