import { Link, useLocation } from 'react-router-dom';
import { Settings, Plus, LayoutGrid } from 'lucide-react';
import { ElementType, useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';

interface NavigationProps {
  isEditorOpen?: boolean;
}

const Navigation = ({ isEditorOpen = false }: NavigationProps) => {
  const location = useLocation();
  const { setSelectedImage } = useApp();
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (!isEditorOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      const threshold = window.innerHeight - 80;
      setIsHovering(e.clientY > threshold);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isEditorOpen]);

  const isActive = (path: string) => location.pathname === path;
  const shouldShow = !isEditorOpen || isHovering;

  const NavItem = ({ to, icon: Icon, title }: { to: string; icon: ElementType; title: string }) => {
    const active = isActive(to);

    return (
      <Link
        to={to}
        onClick={() => setSelectedImage(null)}
        className="group relative flex items-center justify-center w-12 h-12 transition-all duration-300"
        aria-label={title}
      >
        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 pointer-events-none z-50">
          <div className="px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-xl text-[10px] font-bold text-zinc-300 shadow-2xl backdrop-blur-xl whitespace-nowrap">
            {title}
          </div>
        </div>

        <Icon
          size={20}
          strokeWidth={active ? 2.5 : 2}
          className={`relative z-10 transition-all duration-300 ${active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}
        />

        {active && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_hsla(var(--accent-hsl),0.8)] transition-all duration-300 ease-out" />
        )}
      </Link>
    );
  };

  return (
    <>
      {isEditorOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 h-20 z-[110]"
          onMouseEnter={() => setIsHovering(true)}
        />
      )}

      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[120] transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${shouldShow ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}`}
        onMouseLeave={() => isEditorOpen && setIsHovering(false)}
      >
        <div className="flex flex-col items-center">
          <nav className="flex items-center gap-3 p-2 bg-surface/80 backdrop-blur-3xl rounded-[24px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.03]">
            <NavItem to="/" icon={LayoutGrid} title="Library" />

            <Link
              to="/quick-save"
              state={{ backgroundLocation: location }}
              onClick={() => setSelectedImage(null)}
              className="group relative flex items-center justify-center w-14 h-14"
              aria-label="Quick Save"
            >
              <div className="absolute inset-0 bg-accent/20 rounded-[20px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              <div className="relative w-12 h-12 rounded-[20px] bg-accent text-white shadow-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-active:scale-95 group-hover:shadow-[0_0_30px_hsla(var(--accent-hsl),0.4)]">
                <Plus
                  size={26}
                  strokeWidth={2.5}
                  className="transition-transform duration-300 group-hover:rotate-90"
                />
              </div>
            </Link>

            <NavItem to="/settings" icon={Settings} title="Settings" />
          </nav>
        </div>
      </div>
    </>
  );
};

export default Navigation;