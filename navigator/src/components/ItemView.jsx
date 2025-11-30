export default function ItemView({ item }) {
  if (!item) return null;

  return (
    <div>
      <h3>Opera</h3>
      <p>{item.textMedium}</p>
    </div>
  );
}
