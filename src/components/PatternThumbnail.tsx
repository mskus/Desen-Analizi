import React, { useMemo } from 'react';
import { PatternData } from '../types';
import { generatePatternThumbnail } from '../utils/thumbnailGenerator';

interface PatternThumbnailProps {
  pattern: PatternData;
  className?: string;
}

const thumbnailCache = new Map<string, string>();

export const PatternThumbnail: React.FC<PatternThumbnailProps> = ({ pattern, className = '' }) => {
  const thumbnailSrc = useMemo(() => {
    if (pattern.thumbnail && pattern.thumbnail.startsWith('data:image')) {
      return pattern.thumbnail;
    }
    const cacheKey = `${pattern.id}_${pattern.updatedAt || pattern.createdAt || ''}`;
    if (thumbnailCache.has(cacheKey)) {
      return thumbnailCache.get(cacheKey)!;
    }
    const generated = generatePatternThumbnail(pattern);
    if (generated) {
      thumbnailCache.set(cacheKey, generated);
    }
    return generated;
  }, [pattern]);

  if (!thumbnailSrc) {
    return (
      <div
        className={`w-28 h-20 bg-slate-900 border border-slate-800 rounded-md flex items-center justify-center text-slate-500 text-xs shrink-0 ${className}`}
      >
        <span>Önizleme</span>
      </div>
    );
  }

  return (
    <div
      className={`relative w-28 h-20 rounded-md overflow-hidden border border-slate-700/60 bg-slate-950 shrink-0 shadow-inner group-hover:border-cyan-500/50 transition-colors ${className}`}
    >
      <img
        src={thumbnailSrc}
        alt={pattern.title}
        loading="lazy"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};
