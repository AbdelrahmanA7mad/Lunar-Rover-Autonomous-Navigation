export default function StatusToast({ message, kind }) {
  if (!message) return null
  return <div className={`status-toast ${kind || 'info'}`}>{message}</div>
}
