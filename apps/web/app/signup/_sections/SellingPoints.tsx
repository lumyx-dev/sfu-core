import { POINTS } from '@/content/signup';
import s from './SellingPoints.module.css';

// Source: Sign up.dc.html:46-55 — `sc-for list="{{ sellingPoints }}"`, backed by the `POINTS`
// array copied verbatim into content/signup.ts. Static list, no state, so this stays a Server
// Component like every section on this page except SignupWizard.
export function SellingPoints() {
  return (
    <div className={s.list}>
      {POINTS.map((point) => (
        <div key={point.title} className={s.item}>
          <span className={s.body}>
            <span className={s.title}>{point.title}</span>
            <span className={s.copy}>{point.body}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
