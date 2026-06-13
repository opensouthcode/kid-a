import type { Activity } from '../contexts/DataLayerContext';

type ActivityHeaderProps = {
  activity: Activity;
  headingId?: string;
  level?: 'h1' | 'h2';
};

function getIssueLabel(issueUrl: string) {
  return `#${issueUrl.split('/').at(-1)}`;
}

export function ActivityHeader({
  activity,
  headingId,
  level = 'h1',
}: ActivityHeaderProps) {
  const Heading = level;

  return (
    <Heading className="activity-heading" id={headingId}>
      <span>{activity.id.padStart(2, '0')}</span> {activity.title}
      <a
        className="issue-link title-issue-link"
        href={activity.issueUrl}
        rel="noreferrer"
        target="_blank"
      >
        {getIssueLabel(activity.issueUrl)}
      </a>
    </Heading>
  );
}
