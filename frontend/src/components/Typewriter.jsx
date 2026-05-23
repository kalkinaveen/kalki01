import React, { useEffect, useState } from 'react';

const Typewriter = ({ words = [], speed = 70, pause = 1400, className = '' }) => {
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [del, setDel] = useState(false);
  useEffect(() => {
    const word = words[i % words.length] || '';
    const t = setTimeout(() => {
      if (!del) {
        const next = word.slice(0, text.length + 1);
        setText(next);
        if (next === word) setTimeout(() => setDel(true), pause);
      } else {
        const next = word.slice(0, Math.max(0, text.length - 1));
        setText(next);
        if (next === '') { setDel(false); setI(v => v + 1); }
      }
    }, del ? speed / 2 : speed);
    return () => clearTimeout(t);
  }, [text, del, i, words, speed, pause]);
  return (
    <span className={className}>
      {text}
      <span className="eh-caret">&nbsp;</span>
    </span>
  );
};
export default Typewriter;
