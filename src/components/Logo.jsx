import { motion } from 'framer-motion';
import WahyNamaaEmblem from './WahyNamaaEmblem';

export default function Logo({ size = 42, showText = true, variant = 'dark' }) {
  const isLight = variant === 'light';

  return (
    <motion.div
      className="logo-container flex items-center gap-3 select-none"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="shrink-0 flex items-center justify-center">
        <WahyNamaaEmblem size={size} variant={isLight ? 'light' : 'default'} glow={!isLight} />
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span
            className={`font-black tracking-tight font-serif ${
              isLight ? 'text-white' : 'text-[#0e382b]'
            }`}
            style={{ 
              fontSize: `${Math.max(15, size * 0.44)}px`, 
              lineHeight: '1.2' 
            }}
          >
            وَحْيٌ وَنَمَاء
          </span>
          <span
            className={`font-bold tracking-[0.2em] uppercase leading-none mt-0.5 ${
              isLight ? 'text-[#f1e5c5]' : 'text-[#14533e]'
            }`}
            style={{ 
              fontSize: `${Math.max(9, size * 0.23)}px` 
            }}
          >
            WAHY WA NAMAA
          </span>
        </div>
      )}
    </motion.div>
  );
}
