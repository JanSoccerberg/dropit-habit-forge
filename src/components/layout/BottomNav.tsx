import { NavLink } from "react-router-dom";
import { Home, PlusCircle, UserRound, Link2 } from "lucide-react";

const itemCls = ({ isActive }: { isActive: boolean }) =>
  `${isActive ? "text-primary" : "text-muted-foreground"} flex-1 flex flex-col items-center justify-center py-2`;

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto max-w-md grid grid-cols-4">
        <NavLink to="/" end className={itemCls}>
          <Home className="h-5 w-5" />
          <span className="text-xs">Übersicht</span>
        </NavLink>
        <NavLink to="/create" className={itemCls}>
          <PlusCircle className="h-5 w-5" />
          <span className="text-xs">Neu</span>
        </NavLink>
        <NavLink to="/join" className={itemCls}>
          <Link2 className="h-5 w-5" />
          <span className="text-xs">Beitreten</span>
        </NavLink>
        <NavLink to="/profile" className={itemCls}>
          <UserRound className="h-5 w-5" />
          <span className="text-xs">Profil</span>
        </NavLink>
      </div>
    </nav>
  );
}
