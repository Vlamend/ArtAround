export default function MapView({ config }) {
  return (
    <div>
      <h2>{config.museumName}</h2>
      <img src={config.mapImage} alt="map" style={{ width: "100%" }} />
    </div>
  );
}
