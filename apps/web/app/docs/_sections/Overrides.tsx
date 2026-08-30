import { OVERRIDE_SAMPLE } from '@/content/metrics';
import s from './Overrides.module.css';

// Source: Docs.dc.html:120-128.
export function Overrides() {
  return (
    <section id="overrides" className={s.section}>
      <h2 className={s.title}>Overriding a threshold</h2>
      <p className={s.body}>
        Thresholds are per project and per environment. A staging environment that runs on a bad
        office link should not page anyone.
      </p>
      <div className={s.sample}>
        {OVERRIDE_SAMPLE.map((line, i) => (
          <span key={i} className={s.sampleLine}>
            {line}
          </span>
        ))}
      </div>
    </section>
  );
}
