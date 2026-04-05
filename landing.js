'use strict';

// ── Nav background on scroll ──
const nav = document.getElementById('nav');
function handleScroll() {
  if (window.scrollY > 40) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}
window.addEventListener('scroll', handleScroll, { passive: true });
handleScroll();

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const navH = nav ? nav.offsetHeight : 80;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── Intersection Observer for fade-up animations ──
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ── Dynamic pricing based on locale ──
const PRICES = {
  USD: '$4.99',  GBP: '£3.99',  EUR: '€4.49',  AED: 'AED 18',
  SAR: 'SAR 18', QAR: 'QAR 18', KWD: 'KWD 1.5', BHD: 'BHD 1.9',
  OMR: 'OMR 1.9', INR: '₹399',  AUD: 'A$7.99',  CAD: 'C$6.99',
  SGD: 'S$6.99', NZD: 'NZ$7.99', HKD: 'HK$39',  JPY: '¥750',
  CNY: '¥35',    PKR: 'PKR 1,400', BRL: 'R$24.9', MXN: 'MX$89',
  ZAR: 'R89',    NGN: '₦7,500',  KES: 'KES 650', CHF: 'CHF 4.49',
  SEK: 'SEK 52', NOK: 'NOK 52',  DKK: 'DKK 33', MYR: 'RM 22',
  THB: '฿179',   PHP: '₱289',
};

function getLocalPrice() {
  const locale = navigator.language || 'en-US';
  const region = locale.split('-')[1] || '';
  const currencyMap = {
    AE:'AED', SA:'SAR', QA:'QAR', KW:'KWD', BH:'BHD', OM:'OMR',
    US:'USD', GB:'GBP', DE:'EUR', FR:'EUR', IT:'EUR', ES:'EUR',
    NL:'EUR', PT:'EUR', IE:'EUR', AT:'EUR', BE:'EUR', FI:'EUR',
    IN:'INR', AU:'AUD', CA:'CAD', SG:'SGD', NZ:'NZD', HK:'HKD',
    JP:'JPY', CN:'CNY', PK:'PKR', BR:'BRL', MX:'MXN', ZA:'ZAR',
    NG:'NGN', KE:'KES', CH:'CHF', SE:'SEK', NO:'NOK', DK:'DKK',
    MY:'MYR', TH:'THB', PH:'PHP',
  };
  const currency = currencyMap[region] || 'USD';
  return PRICES[currency] || PRICES.USD;
}

const BIZ_PRICES = {
  USD:'$19.99', GBP:'£15.99', EUR:'€17.99', AED:'AED 73',
  SAR:'SAR 75', QAR:'QAR 73', KWD:'KWD 6.1', BHD:'BHD 7.5',
  OMR:'OMR 7.7', INR:'₹1,599', AUD:'A$29.99', CAD:'C$26.99',
  SGD:'S$26.99', NZD:'NZ$29.99', HKD:'HK$155', JPY:'¥2,999',
  CNY:'¥145', PKR:'PKR 5,500', BRL:'R$99', MXN:'MX$349',
  ZAR:'R349', NGN:'₦29,999', KES:'KES 2,599', CHF:'CHF 17.99',
  SEK:'SEK 209', NOK:'NOK 209', DKK:'DKK 134', MYR:'RM 89',
  THB:'฿699', PHP:'₱1,149',
};

const proEl = document.getElementById('landing-price-pro');
if (proEl) proEl.textContent = getLocalPrice();
const bizEl = document.getElementById('landing-price-biz');
if (bizEl) bizEl.textContent = BIZ_PRICES[detectCurrency()] || BIZ_PRICES.USD;

function detectCurrency() {
  const locale = navigator.language || 'en-US';
  const region = locale.split('-')[1] || '';
  const map = {
    AE:'AED', SA:'SAR', QA:'QAR', KW:'KWD', BH:'BHD', OM:'OMR',
    US:'USD', GB:'GBP', DE:'EUR', FR:'EUR', IT:'EUR', ES:'EUR',
    NL:'EUR', PT:'EUR', IE:'EUR', AT:'EUR', BE:'EUR', FI:'EUR',
    IN:'INR', AU:'AUD', CA:'CAD', SG:'SGD', NZ:'NZD', HK:'HKD',
    JP:'JPY', CN:'CNY', PK:'PKR', BR:'BRL', MX:'MXN', ZA:'ZAR',
    NG:'NGN', KE:'KES', CH:'CHF', SE:'SEK', NO:'NOK', DK:'DKK',
    MY:'MYR', TH:'THB', PH:'PHP',
  };
  return map[region] || 'USD';
}
