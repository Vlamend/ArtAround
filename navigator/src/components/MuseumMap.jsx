import { useEffect, useState } from 'react';
import './MuseumMap.css';

const POI_GLYPH = {
  entrance: '\u2192',
  exit: '\u2190',
  emergency_exit: '\u26A0',
  restroom: 'WC',
  bar: 'BAR',
  shop: 'SHOP',
  elevator: '\u2B06',
  stairs: '\u2261',
  obstacle: '!'
};

export default function MuseumMap({ steps, currentIndex, rooms = [], pointsOfInterest = [], floorPlans = [], onSelectStep }) {
  // Piano della tappa corrente (via la sua sala), usato come piano di
  // default quando si apre la mappa.
  const roomById = new Map(rooms.map(r => [r._id, r]));
  const currentRoom = roomById.get(steps[currentIndex]?.item?.roomId);
  const [selectedFloor, setSelectedFloor] = useState(currentRoom?.floor ?? rooms[0]?.floor ?? 0);

  // Se l'utente naviga a un item su un altro piano mentre la mappa è
  // chiusa, al riapertura la mappa segue automaticamente quel piano.
  useEffect(() => {
    if (currentRoom?.floor !== undefined) setSelectedFloor(currentRoom.floor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const floorsAvailable = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
  const floorPlan = floorPlans.find(fp => fp.floor === selectedFloor);

  const stepsOnFloor = steps
    .map((step, i) => ({ step, i }))
    .filter(({ step }) => roomById.get(step.item?.roomId)?.floor === selectedFloor);

  const poiOnFloor = pointsOfInterest.filter(poi => poi.floor === selectedFloor);
  const roomsOnFloor = rooms.filter(r => r.floor === selectedFloor);

  return (
    <div className="museum-map">
      {floorsAvailable.length > 1 && (
        <div className="floor-tabs">
          {floorsAvailable.map(floor => (
            <button
              key={floor}
              className={floor === selectedFloor ? 'floor-tab floor-tab-active' : 'floor-tab'}
              onClick={() => setSelectedFloor(floor)}
            >
              Piano {floor}
            </button>
          ))}
        </div>
      )}
      {floorPlan ? (
        <MapWithFloorPlan
          imageUrl={floorPlan.imageUrl}
          steps={stepsOnFloor}
          currentIndex={currentIndex}
          pointsOfInterest={poiOnFloor}
          onSelectStep={onSelectStep}
        />
      ) : (
        <MapAbstract
          rooms={roomsOnFloor}
          steps={stepsOnFloor}
          currentIndex={currentIndex}
          pointsOfInterest={poiOnFloor}
          onSelectStep={onSelectStep}
        />
      )}
    </div>
  );
}

// Modalità planimetria reale: l'immagine fornita dal museo come sfondo,
// marker posizionati in percentuale (non SVG scalato: così non si
// distorcono se l'immagine non è quadrata).
function MapWithFloorPlan({ imageUrl, steps, currentIndex, pointsOfInterest, onSelectStep }) {
  return (
    <div className="floorplan-frame">
      <img src={imageUrl} alt="Planimetria del piano" className="floorplan-image" />

      {pointsOfInterest.map((poi, idx) => (
        <div
          key={`poi-${idx}`}
          className="marker marker-poi"
          style={{ left: `${poi.coords?.x ?? 0}%`, top: `${poi.coords?.y ?? 0}%` }}
          title={poi.name}
        >
          {POI_GLYPH[poi.type] ?? '\u2022'}
        </div>
      ))}

      {steps.map(({ step, i }) => {
        const item = step.item;
        const isCurrent = i === currentIndex;
        return (
          <button
            key={item?._id ?? i}
            className={isCurrent ? 'marker marker-step marker-step-current' : 'marker marker-step'}
            style={{ left: `${item?.coords?.x ?? 0}%`, top: `${item?.coords?.y ?? 0}%` }}
            onClick={() => onSelectStep?.(i)}
            title={item?.title}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

// Fallback: nessuna planimetria fornita per questo piano. Rettangoli
// astratti calcolati da Museum.rooms[].bounds, invece di lasciare i
// marker fluttuare senza alcun riferimento spaziale.
function MapAbstract({ rooms, steps, currentIndex, pointsOfInterest, onSelectStep }) {
  console.log('MapAbstract', { rooms, steps, currentIndex, pointsOfInterest });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mappa del piano" className="abstract-map">
      <rect x="0" y="0" width="100" height="100" rx="4" className="map-bg" />

      {rooms.filter(r => r.bounds).map(room => (
        <g key={room._id}>
          <rect x={room.bounds.x} y={room.bounds.y} width={room.bounds.width} height={room.bounds.height} className="map-room-wall" />
          <text x={room.bounds.x + 2} y={room.bounds.y + 5} className="map-room-label">{room.name}</text>
        </g>
      ))}

      {pointsOfInterest.map((poi, idx) => (
        <g key={`poi-${idx}`} transform={`translate(${poi.coords?.x ?? 0}, ${poi.coords?.y ?? 0})`}>
          <circle r="2.4" className="map-poi-dot" />
          <text y="-3.5" textAnchor="middle" className="map-poi-label">{POI_GLYPH[poi.type] ?? '\u2022'}</text>
        </g>
      ))}

      {steps.map(({ step, i }) => {
        const item = step.item;
        const isCurrent = i === currentIndex;
        return (
          <g
            key={item?._id ?? i}
            transform={`translate(${item?.coords?.x ?? 0}, ${item?.coords?.y ?? 0})`}
            className={isCurrent ? 'map-step map-step-current' : 'map-step'}
            onClick={() => onSelectStep?.(i)}
          >
            <circle r={isCurrent ? 4.2 : 2.8} className="map-step-dot" />
            <text y="1" textAnchor="middle" className="map-step-number">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}
