import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChartBar, ShoppingCart, Package, Bell, GearSix,
  TrendUp, Storefront, FileText, Receipt,
} from "@phosphor-icons/react";

const BOTTOM_NAV = {
  admin: [
    { to: "/dashboard",  label: "Home",      icon: ChartBar     },
    { to: "/orders",     label: "Orders",    icon: ShoppingCart },
    { to: "/inventory",  label: "Inventory", icon: Package      },
    { to: "/analytics",  label: "Analytics", icon: TrendUp      },
    { to: "/settings",   label: "Settings",  icon: GearSix      },
  ],
  dealer: [
    { to: "/dashboard",     label: "Home",    icon: ChartBar     },
    { to: "/browse",        label: "Browse",  icon: Package      },
    { to: "/orders",        label: "Orders",  icon: ShoppingCart },
    { to: "/invoices",      label: "Invoices",icon: FileText     },
    { to: "/notifications", label: "Alerts",  icon: Bell         },
  ],
  cnf: [
    { to: "/dashboard",     label: "Home",     icon: ChartBar     },
    { to: "/dealers",       label: "Dealers",  icon: Storefront   },
    { to: "/orders",        label: "Orders",   icon: ShoppingCart },
    { to: "/analytics",     label: "Analytics",icon: TrendUp      },
    { to: "/notifications", label: "Alerts",   icon: Bell         },
  ],
  mnp: [
    { to: "/dashboard",     label: "Home",     icon: ChartBar     },
    { to: "/dealers",       label: "Dealers",  icon: Storefront   },
    { to: "/orders",        label: "Orders",   icon: ShoppingCart },
    { to: "/analytics",     label: "Analytics",icon: TrendUp      },
    { to: "/notifications", label: "Alerts",   icon: Bell         },
  ],
  supplier: [
    { to: "/dashboard",       label: "Home",  icon: ChartBar    },
    { to: "/purchase-orders", label: "POs",   icon: Receipt     },
    { to: "/notifications",   label: "Alerts",icon: Bell        },
  ],
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function BottomNav() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const items = BOTTOM_NAV[user?.role] || [];

  // Only render on mobile and when there are items
  if (!isMobile || items.length === 0) return null;

  return (
    <nav
      className="yf-bottom-nav"
      aria-label="Mobile navigation"
      data-testid="bottom-nav"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `yf-bottom-nav-item${isActive ? " active" : ""}`
            }
            aria-label={item.label}
            data-testid={`bottom-nav-${item.to.replace(/\//g, "")}-link`}
          >
            {({ isActive }) => (
              <span className="yf-bottom-nav-dot flex flex-col items-center gap-0.5">
                <Icon size={22} weight={isActive ? "fill" : "regular"} />
                <span style={{ fontSize: 10, lineHeight: 1 }}>{item.label}</span>
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
