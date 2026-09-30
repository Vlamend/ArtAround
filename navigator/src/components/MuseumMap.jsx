import { useEffect, useState } from 'react';

// Nome dei tipi di punto di interesse mostrato nella legenda
const POI_LABELS = {
  entrance: 'Ingresso',
  exit: 'Uscita',
  emergency_exit: 'Uscita emergenza',
  restroom: 'Bagni',
  bar: 'Bar',
  shop: 'Negozio',
  elevator: 'Ascensore',
  stairs: 'Scale',
  obstacle: 'Ostacolo'
};

// Simbolo o sigla con cui ogni tipo di punto di interesse è disegnato sulla mappa
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

/*
 * Finestra modale con la mappa del museo, un piano alla volta.
 * Mostra le tappe della visita (quella corrente evidenziata), i punti di interesse
 * e una legenda. Un clic su una tappa chiama onSelectStep.
 * Se il museo ha la planimetria del piano la usa come sfondo (MapWithFloorPlan),
 * altrimenti disegna le sale come rettangoli (MapAbstract).
 */
export default function MuseumMap({ steps, currentIndex, rooms = [], pointsOfInterest = [], floorPlans = [], onSelectStep, closeMap }) {
  // Sala della tappa corrente: il suo piano è quello mostrato all'apertura della mappa
  const roomById = new Map(rooms.map(r => [r._id, r]));
  const currentRoom = roomById.get(steps[currentIndex]?.artwork?.roomId);

  const [selectedFloor, setSelectedFloor] = useState(
    currentRoom?.floor ?? rooms[0]?.floor ?? 0
  );

  // Finché la mappa è aperta blocca lo scroll della pagina sotto e lo ripristina alla chiusura
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Quando cambia la tappa corrente la mappa passa al piano di quella tappa
  useEffect(() => {
    if (currentRoom?.floor !== undefined) {
      setSelectedFloor(currentRoom.floor);
    }
  }, [currentIndex]);

  // Dati del piano selezionato: piani disponibili, planimetria, tappe (con il loro indice), punti di interesse e sale
  const floorsAvailable = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
  const floorPlan = floorPlans.find(fp => fp.floor === selectedFloor);

  const stepsOnFloor = steps
    .map((step, i) => ({ step, i }))
    .filter(({ step }) => roomById.get(step.artwork?.roomId)?.floor === selectedFloor);

  const poiOnFloor = pointsOfInterest.filter(poi => poi.floor === selectedFloor);
  const roomsOnFloor = rooms.filter(r => r.floor === selectedFloor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 select-none">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-auto rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex w-full shrink-0 gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
          <div className="flex w-full shrink-0 items-center justify-between border-b border-gray-200 p-3 dark:border-gray-700">
            <div className="flex gap-2">
              {floorsAvailable.length > 1 &&
                floorsAvailable.map(floor => (
                  <button
                    key={floor}
                    className={
                      floor === selectedFloor
                        ? 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white dark:bg-secondary'
                        : 'rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                    }
                    onClick={() => setSelectedFloor(floor)}
                  >
                    Piano {floor}
                  </button>
                ))}
            </div>

            <button
              type="button"
              onClick={() => closeMap(false)}
              aria-label="Chiudi mappa"
              className="bg-gray-100 px-4 py-2 rounded-xl cursor-pointer text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              X
            </button>
          </div>
        </div>

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

        {/* Legenda */}
        <div className="mt-3 shrink-0 border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 font-semibold text-gray-800 dark:text-gray-100">
            Legenda
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {/* Tappa corrente */}
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white dark:bg-secondary">
                1
              </span>

              <span className="text-gray-700 dark:text-gray-300">
                Tappa corrente
              </span>
            </div>

            {/* Altra tappa */}
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-700 bg-white text-[10px] font-bold text-gray-800 dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100">
                2
              </span>

              <span className="text-gray-700 dark:text-gray-300">
                Tappa
              </span>
            </div>

            {/* POI presenti sulla mappa */}
            {[...new Set(pointsOfInterest.map(poi => poi.type))]
              .filter(type => POI_LABELS[type])
              .map(type => (
                <div key={type} className="flex items-center gap-2">
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-gray-100 px-1 text-[9px] font-bold text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200">
                    {POI_GLYPH[type] ?? '•'}
                  </span>

                  <span className="text-gray-700 dark:text-gray-300">
                    {POI_LABELS[type]}
                  </span>
                </div>
              ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// Mappa con la planimetria del museo come immagine di sfondo.
// I marker sono posizionati con coordinate in percentuale sull'immagine,
// così restano al loro posto qualunque sia la sua dimensione.
function MapWithFloorPlan({
  imageUrl,
  steps,
  currentIndex,
  pointsOfInterest,
  onSelectStep
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-b-xl bg-gray-100 dark:bg-gray-900">
      <img
        src={imageUrl}
        alt="Planimetria del piano"
        className="block h-auto w-full"
      />

      {/* Punti di interesse */}
      {pointsOfInterest.map((poi, idx) => (
        <div
          key={`poi-${idx}`}
          className="
            absolute z-10
            -translate-x-1/2 -translate-y-1/2
            rounded-md
            border border-gray-700/30
            bg-white/90
            px-1.5 py-0.5
            text-[10px] font-bold
            leading-none
            text-gray-700
            shadow-sm
            backdrop-blur-sm
            dark:border-gray-200/20
            dark:bg-gray-900/85
            dark:text-gray-200
          "
          style={{
            left: `${poi.coords?.x ?? 0}%`,
            top: `${poi.coords?.y ?? 0}%`
          }}
          title={poi.name}
        >
          {POI_GLYPH[poi.type] ?? '•'}
        </div>
      ))}

      {/* Tappe */}
      {steps.map(({ step, i }) => {
        const artwork = step.artwork;
        const isCurrent = i === currentIndex;

        return (
          <button
            key={artwork?._id ?? i}
            className={
              isCurrent
                ? `
                  absolute z-20
                  flex h-9 w-9
                  -translate-x-1/2 -translate-y-1/2
                  items-center justify-center
                  rounded-full
                  border-2 border-white
                  bg-primary
                  text-sm font-bold text-white
                  shadow-lg
                  ring-4 ring-primary/30
                  transition-transform duration-200
                  hover:scale-110
                  dark:border-gray-900
                  dark:bg-secondary
                  dark:ring-secondary/30
                `
                : `
                  absolute z-10
                  flex h-8 w-8
                  -translate-x-1/2 -translate-y-1/2
                  items-center justify-center
                  rounded-full
                  border-2 border-gray-700/70
                  bg-white/95
                  text-sm font-bold text-gray-800
                  shadow-md
                  backdrop-blur-sm
                  transition-transform duration-200
                  hover:scale-110
                  dark:border-gray-200/70
                  dark:bg-gray-800/95
                  dark:text-gray-100
                `
            }

            style={{
              left: `${artwork?.coords?.x ?? 0}%`,
              top: `${artwork?.coords?.y ?? 0}%`
            }}
            onClick={() => onSelectStep?.(i)}
            title={artwork?.title}
          >
            {i + 1}
          </button>
        );
      }
      )}
      {steps.map(({ step, i }) => {
        const artwork = step.artwork;
        console.log(artwork.coords)
      })}
    </div>
  );
}
// Mappa alternativa per i piani senza planimetria: disegna le sale come
// rettangoli, usando i bounds di ogni sala, e sopra di esse punti di interesse e tappe.
// Le coordinate sono in una griglia da 0 a 100.
function MapAbstract({ rooms, steps, currentIndex, pointsOfInterest, onSelectStep }) {
  return (
    <div className="w-full overflow-hidden rounded-b-xl bg-gray-100 dark:bg-gray-900">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Mappa del piano"
        className="block h-auto w-full"
      >
        {/* Sfondo */}
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          rx="4"
          className="fill-gray-100 dark:fill-gray-900"
        />

        {/* Stanze */}
        {rooms.filter(r => r.bounds).map(room => (
          <g key={room._id}>
            <rect
              x={room.bounds.x}
              y={room.bounds.y}
              width={room.bounds.width}
              height={room.bounds.height}
              rx="1"
              className="fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-600"
              strokeWidth="0.6"
            />

            <text
              x={room.bounds.x + 2}
              y={room.bounds.y + 5}
              className="fill-gray-600 text-[3px] font-medium dark:fill-gray-300"
            >
              {room.name}
            </text>
          </g>
        ))}
        {/* Punti di interesse */}
        {pointsOfInterest.map((poi, idx) => (
          <g
            key={`poi-${idx}`}
            transform={`translate(${poi.coords?.x ?? 0}, ${poi.coords?.y ?? 0})`}
          >
            <circle
              r="2.4"
              className="fill-gray-700 dark:fill-gray-200"
            />
            <text
              y="-3.5"
              textAnchor="middle"
              className="fill-gray-700 text-[3px] font-bold dark:fill-gray-200"
            >
              {POI_GLYPH[poi.type] ?? '•'}
            </text>
          </g>
        ))}
        {/* Tappe */}
        {steps.map(({ step, i }) => {
          const artwork = step.artwork;
          const isCurrent = i === currentIndex;
          return (
            <g
              key={artwork?._id ?? i}
              transform={`translate(${artwork?.coords?.x ?? 0}, ${artwork?.coords?.y ?? 0})`}
              className="cursor-pointer"
              onClick={() => onSelectStep?.(i)}
            >
              <circle
                r={isCurrent ? 4.2 : 3}
                className={
                  isCurrent
                    ? 'fill-primary stroke-white dark:fill-secondary dark:stroke-gray-900'
                    : 'fill-white stroke-gray-700 dark:fill-gray-700 dark:stroke-gray-200'
                }
                strokeWidth="0.8"
              />
              <text
                y="1"
                textAnchor="middle"
                className={
                  isCurrent
                    ? 'fill-white text-[3px] font-bold'
                    : 'fill-gray-800 text-[2.5px] font-bold dark:fill-white'
                }
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}