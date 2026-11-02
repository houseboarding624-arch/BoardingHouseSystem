export default function Notice({ type = 'success', children }) {
  if (!children) return null;
  return <div className={`notice ${type === 'error' ? 'notice-error' : 'notice-success'}`}>{children}</div>;
}
