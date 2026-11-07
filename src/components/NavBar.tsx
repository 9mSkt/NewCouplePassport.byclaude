import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';
import { useI18n, type MsgKey } from '../i18n';

const ITEMS: { to: string; icon: string; label: MsgKey }[] = [
  { to: '/book', icon: 'book', label: 'nav.book' },
  { to: '/stamps', icon: 'stamp', label: 'nav.stamps' },
  { to: '/map', icon: 'map', label: 'nav.map' },
  { to: '/missions', icon: 'star', label: 'nav.missions' },
];

export function NavBar() {
  const { t } = useI18n();
  return (
    <nav className="navbar" aria-label="Main">
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} className={({ isActive }) => `navitem ${isActive ? 'is-active' : ''}`}>
          <Icon name={it.icon} size={20} />
          <span>{t(it.label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
