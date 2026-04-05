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

const priceEl = document.getElementById('landing-price');
if (priceEl) priceEl.textContent = getLocalPrice();
