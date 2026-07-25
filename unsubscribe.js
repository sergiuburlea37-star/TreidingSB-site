// unsubscribe.js
// JS dedicat paginii unsubscribe.html - fisier extern separat, NU modifica
// script.js. Motivul pentru care e fisier extern si nu <script> inline in
// pagina: CSP-ul din vercel.json (script-src 'self' ...) nu include
// 'unsafe-inline', deci un <script> inline ar fi blocat silentios de browser
// la incarcarea paginii; un fisier extern servit de pe acelasi domeniu
// respecta 'self' si ruleaza normal.
//
// Citeste tokenul din URL (?token=...) si il trimite catre server o singura
// data, la incarcarea paginii. Tokenul NU este niciodata afisat pe pagina si
// nu este niciodata trecut prin console.log/console.error - nici in caz de
// succes, nici in caz de eroare.
(function () {
  var UNSUB_I18N = {
    ro: {
      eyebrow: 'Notificări email',
      pageTitle: 'Dezabonare de la notificări',
      pageSubtitle: 'Procesăm cererea ta de dezabonare de la notificările TreidingSB.',
      processing: 'Se procesează cererea...',
      successTitle: 'Dezabonare reușită',
      successText: 'Nu vei mai primi notificări prin email de la TreidingSB. Te poți reabona oricând din site.',
      successLink: 'Înapoi la site',
      invalidTitle: 'Link invalid sau expirat',
      invalidText: 'Acest link de dezabonare nu mai este valabil. Este posibil să fi fost deja folosit sau să fi expirat.',
      invalidLink: 'Înapoi la site',
      errorTitle: 'Eroare temporară',
      errorText: 'A apărut o eroare temporară. Te rugăm să încerci din nou peste câteva minute.',
      errorRetry: 'Încearcă din nou'
    },
    en: {
      eyebrow: 'Email notifications',
      pageTitle: 'Unsubscribe from notifications',
      pageSubtitle: 'We are processing your request to unsubscribe from TreidingSB notifications.',
      processing: 'Processing your request...',
      successTitle: 'Unsubscribed successfully',
      successText: 'You will no longer receive email notifications from TreidingSB. You can resubscribe anytime from the website.',
      successLink: 'Back to website',
      invalidTitle: 'Invalid or expired link',
      invalidText: 'This unsubscribe link is no longer valid. It may have already been used or expired.',
      invalidLink: 'Back to website',
      errorTitle: 'Temporary error',
      errorText: 'A temporary error occurred. Please try again in a few minutes.',
      errorRetry: 'Try again'
    },
    ru: {
      eyebrow: 'Уведомления по email',
      pageTitle: 'Отписка от уведомлений',
      pageSubtitle: 'Мы обрабатываем ваш запрос на отписку от уведомлений TreidingSB.',
      processing: 'Обработка запроса...',
      successTitle: 'Вы успешно отписались',
      successText: 'Вы больше не будете получать уведомления по email от TreidingSB. Вы можете подписаться снова в любое время на сайте.',
      successLink: 'Вернуться на сайт',
      invalidTitle: 'Ссылка недействительна или истекла',
      invalidText: 'Эта ссылка для отписки больше недействительна. Возможно, она уже была использована или истекла.',
      invalidLink: 'Вернуться на сайт',
      errorTitle: 'Временная ошибка',
      errorText: 'Произошла временная ошибка. Пожалуйста, попробуйте снова через несколько минут.',
      errorRetry: 'Попробовать снова'
    },
    uk: {
      eyebrow: 'Сповіщення email',
      pageTitle: 'Відписка від сповіщень',
      pageSubtitle: 'Ми обробляємо ваш запит на відписку від сповіщень TreidingSB.',
      processing: 'Обробка запиту...',
      successTitle: 'Ви успішно відписалися',
      successText: 'Ви більше не отримуватимете сповіщення електронною поштою від TreidingSB. Ви можете підписатися знову будь-коли на сайті.',
      successLink: 'Повернутися на сайт',
      invalidTitle: 'Посилання недійсне або застаріле',
      invalidText: 'Це посилання для відписки більше не дійсне. Можливо, воно вже було використане або застаріло.',
      invalidLink: 'Повернутися на сайт',
      errorTitle: 'Тимчасова помилка',
      errorText: 'Сталася тимчасова помилка. Будь ласка, спробуйте ще раз за кілька хвилин.',
      errorRetry: 'Спробувати ще раз'
    },
    pl: {
      eyebrow: 'Powiadomienia e-mail',
      pageTitle: 'Wypisanie z powiadomień',
      pageSubtitle: 'Przetwarzamy Twoją prośbę o wypisanie z powiadomień TreidingSB.',
      processing: 'Przetwarzanie żądania...',
      successTitle: 'Wypisano pomyślnie',
      successText: 'Nie będziesz już otrzymywać powiadomień e-mail od TreidingSB. Możesz ponownie zapisać się w dowolnym momencie na stronie.',
      successLink: 'Powrót do strony',
      invalidTitle: 'Nieprawidłowy lub wygasły link',
      invalidText: 'Ten link do wypisania jest już nieważny. Mógł zostać już użyty lub wygasł.',
      invalidLink: 'Powrót do strony',
      errorTitle: 'Błąd tymczasowy',
      errorText: 'Wystąpił błąd tymczasowy. Spróbuj ponownie za kilka minut.',
      errorRetry: 'Spróbuj ponownie'
    }
  };

  function unsubT(lang, key) {
    var dict = UNSUB_I18N[lang] || UNSUB_I18N.ro;
    return dict[key] || UNSUB_I18N.ro[key] || '';
  }

  function currentUnsubLang() {
    try {
      if (typeof SUPPORTED_LANGS !== 'undefined' && typeof currentLang !== 'undefined' && SUPPORTED_LANGS.includes(currentLang)) {
        return currentLang;
      }
    } catch (e) { /* ignore */ }
    try {
      var urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang && UNSUB_I18N[urlLang]) return urlLang;
    } catch (e) { /* ignore */ }
    return 'ro';
  }

  function renderUnsubscribeTexts() {
    var lang = currentUnsubLang();
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('unsubEyebrowText', unsubT(lang, 'eyebrow'));
    set('unsubPageTitleText', unsubT(lang, 'pageTitle'));
    set('unsubPageSubtitleText', unsubT(lang, 'pageSubtitle'));
    set('unsubProcessingTextEl', unsubT(lang, 'processing'));
    set('unsubSuccessTitleText', unsubT(lang, 'successTitle'));
    set('unsubSuccessTextEl', unsubT(lang, 'successText'));
    set('unsubSuccessLinkText', unsubT(lang, 'successLink'));
    set('unsubInvalidTitleText', unsubT(lang, 'invalidTitle'));
    set('unsubInvalidTextEl', unsubT(lang, 'invalidText'));
    set('unsubInvalidLinkText', unsubT(lang, 'invalidLink'));
    set('unsubErrorTitleText', unsubT(lang, 'errorTitle'));
    set('unsubErrorTextEl', unsubT(lang, 'errorText'));
    set('unsubRetryButton', unsubT(lang, 'errorRetry'));
  }

  function initUnsubscribePage() {
    var root = document.getElementById('unsubscribeBox');
    if (!root) return;

    try {
      var urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang && typeof SUPPORTED_LANGS !== 'undefined' && SUPPORTED_LANGS.includes(urlLang) && typeof applyLanguage === 'function') {
        applyLanguage(urlLang);
      }
    } catch (e) { /* ignore */ }

    renderUnsubscribeTexts();

    var stateProcessing = document.getElementById('unsubscribeProcessingState');
    var stateSuccess = document.getElementById('unsubscribeSuccessState');
    var stateInvalid = document.getElementById('unsubscribeInvalidState');
    var stateError = document.getElementById('unsubscribeErrorState');

    function showState(state) {
      if (stateProcessing) stateProcessing.style.display = state === 'processing' ? '' : 'none';
      if (stateSuccess) stateSuccess.style.display = state === 'success' ? '' : 'none';
      if (stateInvalid) stateInvalid.style.display = state === 'invalid' ? '' : 'none';
      if (stateError) stateError.style.display = state === 'error' ? '' : 'none';
    }

    var token;
    try {
      token = new URLSearchParams(window.location.search).get('token');
    } catch (e) {
      token = null;
    }

    if (!token) {
      showState('invalid');
      return;
    }

    function attemptUnsubscribe() {
      showState('processing');
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unsubscribe', token: token })
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, status: r.status, data: data };
          });
        })
        .then(function (res) {
          if (res.ok && res.data && res.data.success) {
            showState('success');
          } else if (res.status === 400 || res.status === 404) {
            showState('invalid');
          } else {
            showState('error');
          }
        })
        .catch(function () {
          showState('error');
        });
    }

    var retryBtn = document.getElementById('unsubRetryButton');
    if (retryBtn) {
      retryBtn.addEventListener('click', attemptUnsubscribe);
    }

    attemptUnsubscribe();

    if (typeof applyLanguage === 'function' && !applyLanguage.__unsubscribeWrapped) {
      var unsubOriginalApplyLanguage = applyLanguage;
      applyLanguage = function (lang) {
        unsubOriginalApplyLanguage(lang);
        renderUnsubscribeTexts();
      };
      applyLanguage.__unsubscribeWrapped = true;
    }
  }

  // Acest bloc de script e ultimul element din body, deci tot HTML-ul de
  // mai sus (inclusiv unsubscribeBox si cele 4 stari) e deja parsat si
  // disponibil in DOM in momentul in care ajungem aici - rulam direct,
  // fara sa mai astepte DOMContentLoaded. Pastram totusi un listener de
  // rezerva (cu flag anti-dublare) pentru siguranta, in caz ca ordinea
  // reala de incarcare difera fata de cea asteptata.
  var unsubscribeInitRan = false;
  function initUnsubscribePageOnce() {
    if (unsubscribeInitRan) return;
    unsubscribeInitRan = true;
    initUnsubscribePage();
  }
  initUnsubscribePageOnce();
  document.addEventListener('DOMContentLoaded', initUnsubscribePageOnce);
})();
