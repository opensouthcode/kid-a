import { ActivityHeader } from './ActivityHeader';
import type { Activity } from '../contexts/DataLayerContext';

type ActivityHeroProps = {
  activity: Activity;
  eyebrow: string;
  headingId?: string;
};

export function ActivityHero({ activity, eyebrow, headingId }: ActivityHeroProps) {
  return (
    <section className="activity-hero" aria-labelledby={headingId}>
      <p className="eyebrow">{eyebrow}</p>
      <ActivityHeader activity={activity} headingId={headingId} />
      {activity.details ? (
        <p className="site-description">{activity.details}</p>
      ) : null}
    </section>
  );
}
