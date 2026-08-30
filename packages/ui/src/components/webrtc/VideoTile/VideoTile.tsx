import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { Icon } from '../../core/Icon';
import { StatusDot, type StatusDotStatus } from '../../core/StatusDot';
import s from './VideoTile.module.css';

export interface VideoTileProps {
  label?: ReactNode;
  sublabel?: ReactNode;
  status?: StatusDotStatus;
  empty?: boolean;
  emptyText?: string;
  overlay?: ReactNode;
  children?: ReactNode;
  ratio?: string;
  style?: CSSProperties;
}

/* Source :2587-2681. ratio est calcule a l'execution -> aspectRatio reste inline (regle de
   conversion 5). Le capsule bas ne colle PAS uniquement en bas-gauche : c'est une bande
   absolue bottom/left/right (pleine largeur) qui contient une pastille inline-flex hugant la
   gauche (justify-content par defaut du flex parent) — d'ou l'effet "bas-gauche" decrit par le
   handoff, mais ce n'est pas un positionnement bas-gauche dedie. `overlay` est un slot
   generique positionne en haut-a-droite (pas une "capsule qualite" cablee en dur : le
   composant ne sait pas ce qu'il contient, cf. rapport). Le composant ne rend lui-meme ni
   <video> ni <img> — `object-fit: cover` cite dans le brief n'existe nulle part dans la
   source (verifie : aucune occurrence "object-fit"/"objectFit" dans tout le bundle) ; c'est a
   l'appelant de l'appliquer sur son propre media passe en children (cf. rapport,
   divergence). */
export function VideoTile({
  label,
  sublabel,
  status = 'live',
  empty = false,
  emptyText = 'No stream',
  overlay,
  children,
  ratio = '16/10',
  style,
}: VideoTileProps) {
  return (
    <div className={s.tile} style={{ aspectRatio: ratio, ...style }}>
      {!empty && children}

      {empty && (
        <div className={s.empty}>
          <Icon name="video-off" size={24} />
          {emptyText}
        </div>
      )}

      {(label || sublabel) && (
        <span className={s.bar}>
          <span className={cn(s.capsule, empty && s.capsuleEmpty)}>
            <StatusDot status={empty ? 'idle' : status} size={6} halo={false} />
            <span className={s.label}>{label}</span>
            {sublabel && <span className={cn('sl-num', s.sublabel)}>{sublabel}</span>}
          </span>
        </span>
      )}

      {overlay && <span className={s.overlay}>{overlay}</span>}
    </div>
  );
}
