import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChartBar, ShoppingCart, Package, Bell, GearSix,
  TrendUp, Storefront, FileText, Receipt, List,
} from "@phosphor-icons/react";

/** Role-aware bottom nav items (max 5 for comfortable thumb reach) */
const BOTTOM_NAV = {
  admin: [
    { to: "/dashboard",  label: "Home",     icon: ChartBar    },
    { to: "/orders",     label: "Orders",   icon: ShoppingCart },
    { to: "/inventory",  label: "Inventory",icon: Package      },
    { to: "/analytics",  label: "Analytics",icon: TrendUp      },
    { to: "/settings",   label: "Settings", icon: GearSix      },
  ],
  dealer: [
    { to: "/dashboard",     label: "Home",    icon: ChartBar     },
    { to: "/browse",        label: "Browse",  icon: Package      },
    { to: "/orders",        label: "Orders",  icon: ShoppingCart },
    { to: "/invoices",      label: "Invoices",icon: FileText     },
    { to: "/notifications", label: "Alerts",  icon: Bell         },
  ],
  cnf: [
    { to: "/dashboard",     label: "Home",    icon: ChartBar     },
    { to: "/dealers",       label: "Dealers", icon: Storefront   },
    { to: "/orders",        label: "Orders",  icon: ShoppingCart },
    { to: "/analytics",     label: "Analytics",icon: TrendUp     },
    { to: "/notifications", label: "Alerts",  icon: Bell         },
  ],
  mnp: [
    { to: "/dashboard",     label: "Home",    icon: ChartBar     },
    { to: "/dealers",       label: "Dealers", icon: Storefront   },
    { to: "/orders",        label: "Orders",  icon: ShoppingCart },
    { to: "/analytics",     label: "Analytics",icon: TrendUp     },
    { to: "/notifications", label: "Alerts",  icon: Bell         },
  ],
  supplier: [
    { to: "/dashboard",       label: "Home",    icon: ChartBar    },
    { to: "/purchase-orders", label: "POs",     icon: Receipt     },
    { to: "/notifications",   label: "Alerts",  icon: Bell        },
  ],
};

export default function BottomNav() {
  const { user } = useAuth();
  const items = BOTTOM_NAV[user?.role] || [];

  if (items.length === 0) return null;

  return (
    /* md:hidden — only visible on mobile; hidden on tablet+ */
    <nav
      className="yf-bottom-nav md:hidden"
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
                <span className="text-[10px] leading-none">{item.label}</span>
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
