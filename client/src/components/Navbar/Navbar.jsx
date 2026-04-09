import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/game" className="navbar-logo">DOOMGEN</NavLink>
      <NavLink to="/game" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
        Gioco
      </NavLink>
      <NavLink to="/monsters" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
        Mostri
      </NavLink>
      <NavLink to="/surfaces" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
        Superfici
      </NavLink>
      <NavLink to="/levels" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
        Livelli
      </NavLink>
    </nav>
  )
}
