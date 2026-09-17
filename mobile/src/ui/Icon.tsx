/**
 * Jeu d'icônes — même langage graphique que le site (traits fins, 1.6,
 * extrémités arrondies, pas de remplissage). Dessinées en SVG pour rester
 * nettes à toutes les densités et suivre la couleur du texte.
 */
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { colors } from '../theme/tokens';

export type IconName =
  | 'home' | 'folder' | 'scan' | 'calendar' | 'user'
  | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'plus' | 'search'
  | 'filter' | 'trash' | 'download' | 'share' | 'check' | 'close'
  | 'alert' | 'clock' | 'lock' | 'fingerprint' | 'bell' | 'mail'
  | 'whatsapp' | 'file' | 'image' | 'camera' | 'refresh' | 'logout'
  | 'shield' | 'settings' | 'edit' | 'restore' | 'info' | 'phone' | 'help';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 22, color = colors.textPrimary, strokeWidth = 1.6 }: Props) {
  const s = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'home' && <Path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" {...s} />}
      {name === 'folder' && <Path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l1.8 2.2h9A1.5 1.5 0 0 1 21 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" {...s} />}
      {name === 'scan' && (
        <>
          <Path d="M3 8V5.5A1.5 1.5 0 0 1 4.5 4H8M16 4h3.5A1.5 1.5 0 0 1 21 5.5V8M21 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H4.5A1.5 1.5 0 0 1 3 18.5V16" {...s} />
          <Line x1="3" y1="12" x2="21" y2="12" {...s} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x="3.5" y="5" width="17" height="15" rx="2" {...s} />
          <Path d="M3.5 10h17M8 3.5v3M16 3.5v3" {...s} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx="12" cy="8.5" r="3.7" {...s} />
          <Path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" {...s} />
        </>
      )}
      {name === 'chevron-right' && <Path d="m9.5 5.5 6.5 6.5-6.5 6.5" {...s} />}
      {name === 'chevron-left' && <Path d="M14.5 5.5 8 12l6.5 6.5" {...s} />}
      {name === 'chevron-down' && <Path d="m5.5 9.5 6.5 6.5 6.5-6.5" {...s} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...s} />}
      {name === 'search' && (
        <>
          <Circle cx="11" cy="11" r="6.2" {...s} />
          <Path d="m15.6 15.6 4 4" {...s} />
        </>
      )}
      {name === 'filter' && <Path d="M4 6h16l-6.2 7.3V19l-3.6-2v-3.7z" {...s} />}
      {name === 'trash' && <Path d="M4.5 7h15M9.5 7V4.8h5V7M6.8 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.4h5.8a1.5 1.5 0 0 0 1.5-1.4L17.2 7" {...s} />}
      {name === 'download' && <Path d="M12 4v11m0 0 4-4m-4 4-4-4M4.5 19.5h15" {...s} />}
      {name === 'share' && <Path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" {...s} />}
      {name === 'check' && <Path d="m5 12.5 4.5 4.5L19 7.5" {...s} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...s} />}
      {name === 'alert' && (
        <>
          <Path d="M12 4.5 21 20H3z" {...s} />
          <Path d="M12 10v4.2" {...s} />
          <Circle cx="12" cy="17" r="0.9" fill={color} stroke="none" />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx="12" cy="12" r="8.2" {...s} />
          <Path d="M12 7.4V12l3 2" {...s} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect x="5" y="10.5" width="14" height="9.5" rx="2" {...s} />
          <Path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" {...s} />
        </>
      )}
      {name === 'fingerprint' && <Path d="M6 11a6 6 0 0 1 12 0M8.5 12.2a3.5 3.5 0 0 1 7 0v1.3M12 12v5.5M9.2 15.5c0 2 .4 3.4 1 4.5M15 14.5c0 3-.5 4.5-1.2 5.5M4.5 8.2A9 9 0 0 1 19.4 8" {...s} />}
      {name === 'bell' && <Path d="M6.5 17h11l-1.2-2.2V11a4.3 4.3 0 0 0-8.6 0v3.8zM10.3 20h3.4" {...s} />}
      {name === 'mail' && (
        <>
          <Rect x="3.2" y="5.5" width="17.6" height="13" rx="2" {...s} />
          <Path d="m3.8 7 8.2 6 8.2-6" {...s} />
        </>
      )}
      {name === 'whatsapp' && <Path d="M20 11.6a8 8 0 0 1-11.9 7L4 20l1.5-4A8 8 0 1 1 20 11.6zM9 9.2c.3 2.3 2.3 4.4 4.7 5 .6.2 1.3-.2 1.5-.8l.2-.6-2-.9-.6.7a5.7 5.7 0 0 1-2-2l.7-.6-.9-2-.6.2c-.6.2-1 .8-1 1.4z" {...s} />}
      {name === 'file' && <Path d="M13.2 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V8.3zM13 3.6V8.5h5" {...s} />}
      {name === 'image' && (
        <>
          <Rect x="3.5" y="5" width="17" height="14" rx="2" {...s} />
          <Path d="m4.5 17 4.6-5 3.2 3.4 2.6-2.6 4.6 4.2" {...s} />
          <Circle cx="9" cy="9.5" r="1.4" {...s} />
        </>
      )}
      {name === 'camera' && (
        <>
          <Path d="M3.5 8.8A1.5 1.5 0 0 1 5 7.3h2.7l1.4-2.1h5.8l1.4 2.1H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.3H5a1.5 1.5 0 0 1-1.5-1.5z" {...s} />
          <Circle cx="12" cy="13" r="3.4" {...s} />
        </>
      )}
      {name === 'refresh' && <Path d="M20 12a8 8 0 1 1-2.6-5.9M20 4.5V10h-5.4" {...s} />}
      {name === 'logout' && <Path d="M15 8.2V6a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 15 18v-2.2M10.5 12H21m0 0-3.2-3.2M21 12l-3.2 3.2" {...s} />}
      {name === 'shield' && <Path d="M12 3.5 19 6v5.5c0 4-2.8 7.5-7 9-4.2-1.5-7-5-7-9V6z" {...s} />}
      {name === 'settings' && (
        <>
          <Circle cx="12" cy="12" r="3" {...s} />
          <Path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.5 13H4a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 5.3 6.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 2.3V2a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.3.9z" {...s} />
        </>
      )}
      {name === 'edit' && <Path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10zM14.5 6.5l3 3" {...s} />}
      {name === 'restore' && <Path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5V10h5.4" {...s} />}
      {name === 'info' && (
        <>
          <Circle cx="12" cy="12" r="8.2" {...s} />
          <Path d="M12 11v5.2" {...s} />
          <Circle cx="12" cy="7.9" r="0.9" fill={color} stroke="none" />
        </>
      )}
      {name === 'phone' && <Path d="M6.5 4.5h3l1.3 3.3-1.7 1.4a11 11 0 0 0 5.7 5.7l1.4-1.7 3.3 1.3v3a1.5 1.5 0 0 1-1.7 1.5C10.9 18.3 5.7 13.1 5 6.2a1.5 1.5 0 0 1 1.5-1.7z" {...s} />}
      {name === 'help' && (
        <>
          <Circle cx="12" cy="12" r="8.2" {...s} />
          <Path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4" {...s} />
          <Circle cx="12" cy="16.6" r="0.9" fill={color} stroke="none" />
        </>
      )}
    </Svg>
  );
}
