import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RULES } from '../rulesData.js';
import PublicScanner from '../components/PublicScanner.jsx';
import heroPhoto from '../assets/boarding-house.jpg';

// Location shown on the home page map. Change these to move the pin.
const MAP_LINK = 'https://maps.app.goo.gl/nXBEcdRhbRHADWUA9';
const MAP_LAT = 16.724324594052604;
const MAP_LNG = 121.53433476758192;
const MAP_LABEL = 'Napro Dormitory';
const MAP_EMBED = `https://maps.google.com/maps?q=${MAP_LAT},${MAP_LNG}(${encodeURIComponent(MAP_LABEL)})&z=17&hl=en&output=embed`;

const FEATURES = [
  ['👥', 'Boarders', 'Manage boarder accounts and profiles.'],
  ['🚪', 'Rooms', 'Monitor room availability and rates.'],
  ['💳', 'Payments', 'Record and view rental payments.'],
  ['📱', 'QR attendance', 'Time in and out by QR scan.'],
];

export default function Home() {
  // Fade elements in smoothly as they scroll into view.
  useEffect(() => {
    const items = document.querySelectorAll('.lp-reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link className="lp-brand" to="/">
            <span className="lp-brand-icon" aria-hidden="true">🏠</span>
            <span className="lp-brand-text">Boarding House</span>
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-text">
            <p className="lp-kicker">Smart boarding house system</p>
            <h1>
              <span className="lp-title-move">Boarding House Record &amp; Monitoring</span>
            </h1>
            <p className="lp-lead">
              Manage boarders, rooms, payments, and QR attendance in one place.
            </p>

            <div className="lp-actions">
              <Link className="lp-btn lp-btn-primary" to="/login">
                Log in to system
              </Link>
              <a className="lp-btn lp-btn-ghost" href="#rules">
                📋 House rules
              </a>
              <a className="lp-btn lp-btn-ghost" href="#location">
                📍 Location
              </a>
            </div>
          </div>

          <div className="lp-hero-photo-wrap glow-ring">
            <div
              className="lp-hero-photo"
              role="img"
              aria-label="The boarding house building"
              style={{ backgroundImage: `url(${heroPhoto})` }}
            />
          </div>
        </section>

        <section className="lp-scan" id="scan" aria-labelledby="lp-scan-title">
          <div className="lp-scan-card">
            <span className="eyebrow">QR ATTENDANCE</span>
            <h2 id="lp-scan-title" className="lp-scan-blink">Scan your QR here</h2>
            <p>Show your boarder QR to the camera. Each scan switches between Time In and Time Out, as many times as you need until 10:00 PM.</p>
            <PublicScanner />
          </div>
        </section>

        <section className="lp-features" aria-labelledby="lp-features-title">
          <h2 id="lp-features-title" className="lp-reveal">What you can do here</h2>
          <ul className="lp-feature-list">
            {FEATURES.map(([icon, title, text], i) => (
              <li
                key={title}
                className="lp-feature lp-reveal"
                style={{ '--d': `${i * 0.1}s` }}
              >
                <span className="lp-feature-icon" aria-hidden="true">
                  {icon}
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="lp-map" id="location" aria-labelledby="lp-map-title">
          <div className="lp-map-inner">
            <div className="lp-map-head lp-reveal">
              <span className="eyebrow">LOCATION</span>
              <h2 id="lp-map-title">Find us on the map</h2>
              <a
                className="lp-btn lp-btn-primary"
                href={MAP_LINK}
                target="_blank"
                rel="noopener noreferrer"
              >
                📍 Open in Google Maps
              </a>
            </div>
            <div className="lp-map-frame lp-reveal">
              <iframe
                title="Boarding house location map"
                src={MAP_EMBED}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>
      </main>

      <section className="rules" id="rules">
        <div className="rules-inner">
          <div className="rules-head lp-reveal">
            <span className="eyebrow">NAPRO DORMITORY</span>
            <h2>General Rules &amp; Regulations</h2>
            <p>Agreement form for all dormers. Please read and follow these rules.</p>
          </div>

          <div className="rules-grid">
            {RULES.map((rule, index) => (
              <article
                className="rule-card lp-reveal"
                key={rule.title}
                style={{ '--d': `${(index % 2) * 0.1}s` }}
              >
                <h3>
                  <span className="rule-icon" aria-hidden="true">
                    {rule.icon}
                  </span>
                  {index + 1}. {rule.title}
                </h3>
                <ul>
                  {rule.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <p>Boarding House Record &amp; Monitoring System</p>
      </footer>
    </div>
  );
}
