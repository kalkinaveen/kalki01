import React from 'react';

const FONTS = [
  { id: 1, name: 'Pacifico', family: "'Pacifico', cursive", weight: 400 },
  { id: 2, name: 'Caveat Brush', family: "'Caveat Brush', cursive", weight: 400 },
  { id: 3, name: 'Sacramento', family: "'Sacramento', cursive", weight: 400 },
  { id: 4, name: 'Kaushan Script', family: "'Kaushan Script', cursive", weight: 400 },
  { id: 5, name: 'Dancing Script', family: "'Dancing Script', cursive", weight: 700 },
  { id: 6, name: 'Great Vibes', family: "'Great Vibes', cursive", weight: 400 },
  { id: 7, name: 'Satisfy', family: "'Satisfy', cursive", weight: 400 },
  { id: 8, name: 'Permanent Marker', family: "'Permanent Marker', cursive", weight: 400 },
  { id: 9, name: 'Shadows Into Light', family: "'Shadows Into Light', cursive", weight: 400 },
  { id: 10, name: 'Allura', family: "'Allura', cursive", weight: 400 },
  { id: 11, name: 'Yellowtail', family: "'Yellowtail', cursive", weight: 400 },
  { id: 12, name: 'Parisienne', family: "'Parisienne', cursive", weight: 400 },
  { id: 13, name: 'Lobster', family: "'Lobster', cursive", weight: 400 },
  { id: 14, name: 'Cookie', family: "'Cookie', cursive", weight: 400 },
  { id: 15, name: 'Tangerine', family: "'Tangerine', cursive", weight: 700 },
  { id: 16, name: 'Marck Script', family: "'Marck Script', cursive", weight: 400 },
  { id: 17, name: 'Alex Brush', family: "'Alex Brush', cursive", weight: 400 },
  { id: 18, name: 'Italianno', family: "'Italianno', cursive", weight: 400 },
  { id: 19, name: 'Monoton', family: "'Monoton', cursive", weight: 400 },
  { id: 20, name: 'Audiowide', family: "'Audiowide', cursive", weight: 400 },
];

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Pacifico&family=Caveat+Brush&family=Sacramento&family=Kaushan+Script&family=Dancing+Script:wght@700&family=Great+Vibes&family=Satisfy&family=Permanent+Marker&family=Shadows+Into+Light&family=Allura&family=Yellowtail&family=Parisienne&family=Lobster&family=Cookie&family=Tangerine:wght@700&family=Marck+Script&family=Alex+Brush&family=Italianno&family=Monoton&family=Audiowide&display=swap';

const FontPreview = () => {
  React.useEffect(() => {
    const id = 'eh-font-preview-link';
    if (!document.getElementById(id)) {
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet'; l.href = FONT_LINK;
      document.head.appendChild(l);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[var(--eh-bg)] py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <div className="eh-mono text-[10px] sm:text-xs tracking-[.4em] opacity-70 mb-2" style={{ color: 'var(--eh-green)' }}>&gt; font_picker.sh</div>
          <h1 className="eh-brand text-2xl sm:text-4xl font-black tracking-wider" style={{ color: 'var(--eh-green)', textShadow: '0 0 10px rgba(0,255,157,.4)' }}>PICK YOUR FONT</h1>
          <p className="eh-mono text-xs sm:text-sm opacity-70 mt-3">Tell me the <span style={{ color: 'var(--eh-green)' }}>#NUMBER</span> you like for "Your Naughty Don Is Back"</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {FONTS.map((f) => (
            <div key={f.id} data-testid={`font-card-${f.id}`} className="eh-panel px-5 py-5 sm:px-6 sm:py-6" style={{ background: 'rgba(8,10,12,.85)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="eh-mono text-[10px] sm:text-xs tracking-widest opacity-80" style={{ color: 'var(--eh-green)' }}>#{f.id} &nbsp;//&nbsp; {f.name}</span>
                <span className="eh-mono text-[10px] opacity-50">tap to pick</span>
              </div>
              <div
                className="text-center select-none"
                style={{
                  fontFamily: f.family,
                  fontWeight: f.weight,
                  color: 'var(--eh-green)',
                  fontSize: 'clamp(1.4rem, 5vw, 2.4rem)',
                  lineHeight: 1.2,
                  textShadow: '0 0 3px rgba(0,255,157,.9), 0 0 12px rgba(0,255,157,.5), 0 0 24px rgba(0,255,157,.3)',
                }}
              >
                Your Naughty Don Is Back
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center eh-mono text-xs opacity-70">
          Reply with the number (e.g. <span style={{ color: 'var(--eh-green)' }}>#3</span>) and I'll lock it in.
        </div>
      </div>
    </div>
  );
};

export default FontPreview;
