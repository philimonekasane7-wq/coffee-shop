import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const BRAND = "Masuper Iced Coffee";
const CART_KEY = "masuperCart";
const THEME_KEY = "masuperTheme";
const statuses = ["Pending", "Preparing", "Ready", "Collected"];
const emptyItem = { name: "", description: "", price: "", available: true };

const money = value => `M ${Number(value).toFixed(2)}`;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function Notice({ kind, onClose, children }) {
  return (
    <div className={kind} role={kind === "error" ? "alert" : "status"}>
      <span>{children}</span>
      <button
        type="button"
        className="notice-close"
        onClick={onClose}
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  );
}

function StatusBadge({ status }) {
  const safeStatus =
    typeof status === "string" && status.trim()
      ? status
      : "Unknown";

  return (
    <span className={`badge badge-${safeStatus.toLowerCase()}`}>
      {safeStatus}
    </span>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [theme, setTheme] = useState(initialTheme);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const [cart, setCart] = useState(loadCart);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [staff, setStaff] = useState(
    Boolean(localStorage.getItem("staffToken"))
  );

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingId, setEditingId] = useState(null);

  /* ---------- helpers ---------- */

  function go(next) {
    setPage(next);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function signOut(text) {
    localStorage.removeItem("staffToken");
    setStaff(false);
    setOrders([]);
    setPage("home");
    setMessage(text);
  }

  function fail(e) {
    const text = e?.message || "Something went wrong. Please try again.";
    const expired =
      /401|unauthori[sz]ed|token|expired/i.test(text) &&
      localStorage.getItem("staffToken");

    if (expired) {
      signOut("Your session expired. Please sign in again.");
      setPage("login");
      return;
    }
    setError(text);
  }

  async function loadMenu() {
    setMenuLoading(true);
    try {
      setMenu(await api("/api/menu"));
    } catch (e) {
      fail(e);
    } finally {
      setMenuLoading(false);
    }
  }

  async function loadOrders() {
    try {
      setOrders(await api("/api/orders"));
    } catch (e) {
      fail(e);
    }
  }

  /* ---------- effects ---------- */

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ }
  }, [cart]);

  // Keep saved cart in sync with the live menu (prices, availability)
  useEffect(() => {
    if (menu.length === 0) return;
    setCart(old =>
      old
        .map(line => {
          const live = menu.find(m => m.id === line.id);
          return live && live.available
            ? { ...line, name: live.name, price: live.price }
            : null;
        })
        .filter(Boolean)
    );
  }, [menu]);

  // Messages fade out on their own
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // Staff dashboard refreshes itself every 30 seconds
  useEffect(() => {
    if (!staff || page !== "staff") return;
    loadOrders();
    const timer = setInterval(loadOrders, 30000);
    return () => clearInterval(timer);
  }, [staff, page]);

  /* ---------- derived data ---------- */

  const cartCount = cart.reduce((n, x) => n + x.quantity, 0);

  const cartTotal = useMemo(
    () => cart.reduce((sum, x) => sum + x.price * x.quantity, 0),
    [cart]
  );

  const visibleMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter(
      item =>
        (!onlyAvailable || item.available) &&
        `${item.name} ${item.description}`.toLowerCase().includes(q)
    );
  }, [menu, search, onlyAvailable]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [orders]
  );

  const shownOrders =
    statusFilter === "All"
      ? sortedOrders
      : sortedOrders.filter(o => o.status === statusFilter);

  const todayKey = new Date().toDateString();
  const todaysOrders = orders.filter(
    o => new Date(o.createdAt).toDateString() === todayKey
  );
  const todaysTotal = todaysOrders.reduce((sum, o) => sum + o.total, 0);
  const activeCount = todaysOrders.filter(
    o => o.status !== "Collected"
  ).length;
  const collectedCount = todaysOrders.filter(
    o => o.status === "Collected"
  ).length;

  /* ---------- cart ---------- */

  function addToCart(item) {
    setCart(old => {
      const found = old.find(x => x.id === item.id);
      if (found) {
        return old.map(x =>
          x.id === item.id
            ? { ...x, quantity: Math.min(30, x.quantity + 1) }
            : x
        );
      }
      return [...old, { ...item, quantity: 1 }];
    });
    setMessage(`${item.name} added to your cart.`);
    setError("");
  }

  function changeQuantity(id, quantity) {
    if (quantity < 1) {
      setCart(old => old.filter(x => x.id !== id));
    } else {
      setCart(old =>
        old.map(x =>
          x.id === id ? { ...x, quantity: Math.min(30, quantity) } : x
        )
      );
    }
  }

  /* ---------- customer actions ---------- */

  async function placeOrder(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPlacing(true);

    try {
      const order = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName,
          customerContact,
          items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
        })
      });

      setLastOrder(order.order);
      setCart([]);
      setCustomerName("");
      setCustomerContact("");
      go("confirmation");
    } catch (e) {
      fail(e);
    } finally {
      setPlacing(false);
    }
  }

  /* ---------- staff actions ---------- */

  async function staffLogin(event) {
    event.preventDefault();
    setError("");

    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      localStorage.setItem("staffToken", result.token);
      setStaff(true);
      setPassword("");
      setPage("staff");
      setMessage("Welcome back. You are signed in.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveMenuItem(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const payload = { ...itemForm, price: Number(itemForm.price) };

      if (editingId) {
        await api(`/api/menu/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setMessage("Menu item updated.");
      } else {
        await api("/api/menu", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setMessage("Menu item added.");
      }

      setItemForm(emptyItem);
      setEditingId(null);
      await loadMenu();
    } catch (e) {
      fail(e);
    }
  }

  function beginEdit(item) {
    setEditingId(item.id);
    setItemForm({
      name: item.name,
      description: item.description,
      price: item.price,
      available: item.available
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setItemForm(emptyItem);
  }

  async function toggleAvailability(item) {
    try {
      await api(`/api/menu/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          price: Number(item.price),
          available: !item.available
        })
      });
      setMessage(
        `${item.name} marked ${item.available ? "unavailable" : "available"}.`
      );
      await loadMenu();
    } catch (e) {
      fail(e);
    }
  }

  async function deleteMenuItem(item) {
    if (!window.confirm(`Delete "${item.name}" from the menu?`)) return;

    try {
      await api(`/api/menu/${item.id}`, { method: "DELETE" });
      setMessage("Menu item deleted.");
      if (editingId === item.id) cancelEdit();
      await loadMenu();
    } catch (e) {
      fail(e);
    }
  }

  async function updateStatus(id, status) {
    try {
      await api(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setMessage("Order status updated.");
      await loadOrders();
    } catch (e) {
      fail(e);
    }
  }

  /* ---------- render ---------- */

  const navItems = [
    { id: "home", label: "Menu" },
    { id: "cart", label: `Cart`, count: cartCount },
    staff
      ? { id: "staff", label: "Staff dashboard" }
      : { id: "login", label: "Staff login" }
  ];

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="brand brand-button"
          onClick={() => go("home")}
        >
          🧊 {BRAND}
        </button>

        <nav aria-label="Main">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              {item.label}
              {item.count > 0 && (
                <span className="count-pill">{item.count}</span>
              )}
            </button>
          ))}

          {staff && (
            <button type="button" onClick={() => signOut("You have signed out.")}>
              Sign out
            </button>
          )}

          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title="Toggle dark mode"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </nav>
      </header>

      <main className="container">
        {page === "home" && (
          <section className="hero">
            <p className="eyebrow">Brewed strong, served cold</p>
            <h1>Iced coffee, made fresh for you.</h1>
            <p>
              Pick your favourites, place your order, and collect it when
              it&apos;s ready.
            </p>
          </section>
        )}

        <div className="notice-stack">
          {message && (
            <Notice kind="notice" onClose={() => setMessage("")}>
              {message}
            </Notice>
          )}
          {error && (
            <Notice kind="error" onClose={() => setError("")}>
              {error}
            </Notice>
          )}
        </div>

        {/* ---------------- MENU ---------------- */}
        {page === "home" && (
          <section>
            <div className="section-heading">
              <h2>Our menu</h2>
              <button className="secondary" onClick={loadMenu}>
                Refresh menu
              </button>
            </div>

            <div className="toolbar">
              <input
                type="search"
                placeholder="Search the menu"
                aria-label="Search the menu"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={e => setOnlyAvailable(e.target.checked)}
                />
                Available only
              </label>
            </div>

            {menuLoading && menu.length === 0 ? (
              <div className="menu-grid" aria-busy="true">
                {[1, 2, 3, 4].map(n => (
                  <div className="menu-card skeleton" key={n} />
                ))}
              </div>
            ) : (
              <div className="menu-grid">
                {visibleMenu.map(item => {
                  const inCart =
                    cart.find(x => x.id === item.id)?.quantity || 0;

                  return (
                    <article
                      className={`menu-card${item.available ? "" : " is-off"}`}
                      key={item.id}
                    >
                      <div className="coffee-icon">🧊</div>

                      <div className="menu-card-content">
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>

                        <div className="card-bottom">
                          <strong>{money(item.price)}</strong>

                          {item.available ? (
                            <button onClick={() => addToCart(item)}>
                              {inCart > 0 ? `Add another (${inCart})` : "Add to cart"}
                            </button>
                          ) : (
                            <span className="unavailable">Sold out</span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!menuLoading && visibleMenu.length === 0 && (
              <div className="empty">
                <p>
                  {menu.length === 0
                    ? "The menu is empty right now. Check back soon."
                    : "No drinks match your search."}
                </p>
                {menu.length > 0 && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setSearch("");
                      setOnlyAvailable(false);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ---------------- CART ---------------- */}
        {page === "cart" && (
          <section className="panel">
            <div className="section-heading">
              <h2>Your cart</h2>
              {cart.length > 0 && (
                <button className="secondary" onClick={() => setCart([])}>
                  Clear cart
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="empty">
                <p>Your cart is empty.</p>
                <button onClick={() => go("home")}>Browse the menu</button>
              </div>
            ) : (
              <>
                {cart.map(item => (
                  <div className="cart-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{money(item.price)} each</small>
                    </div>

                    <div className="quantity">
                      <button
                        className="secondary"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => changeQuantity(item.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button
                        className="secondary"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => changeQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>
                ))}

                <div className="total">
                  <span>Total</span>
                  <strong>{money(cartTotal)}</strong>
                </div>

                <button onClick={() => go("checkout")}>
                  Continue to checkout
                </button>
              </>
            )}
          </section>
        )}

        {/* ---------------- CHECKOUT ---------------- */}
        {page === "checkout" && (
          <section className="panel narrow">
            <h2>Place your order</h2>

            {cart.length === 0 ? (
              <div className="empty">
                <p>Your cart is empty, so there is nothing to order yet.</p>
                <button onClick={() => go("home")}>Browse the menu</button>
              </div>
            ) : (
              <>
                <ul className="summary-list">
                  {cart.map(item => (
                    <li key={item.id}>
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>{money(item.price * item.quantity)}</span>
                    </li>
                  ))}
                  <li className="summary-total">
                    <span>Total</span>
                    <strong>{money(cartTotal)}</strong>
                  </li>
                </ul>

                <form onSubmit={placeOrder}>
                  <label>
                    Your name
                    <input
                      required
                      minLength="2"
                      autoComplete="name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </label>

                  <label>
                    Contact details
                    <input
                      required
                      minLength="3"
                      autoComplete="email"
                      value={customerContact}
                      onChange={e => setCustomerContact(e.target.value)}
                      placeholder="Phone number or email"
                    />
                  </label>

                  <button disabled={placing}>
                    {placing ? "Placing order…" : "Confirm order"}
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => go("cart")}
                  >
                    Back to cart
                  </button>
                </form>
              </>
            )}
          </section>
        )}

        {/* ---------------- CONFIRMATION ---------------- */}
        {page === "confirmation" && lastOrder && (
          <section className="panel narrow center">
            <div className="success-icon">✓</div>
            <h2>Thank you, {lastOrder.customerName}!</h2>
            <p>Your order number is</p>
            <div className="order-number">{lastOrder.orderNumber}</div>
            <p>
              Status: <StatusBadge status={lastOrder.status} />
            </p>
            <p>
              Total: <strong>{money(lastOrder.total)}</strong>
            </p>
            <p className="hint">
              Show this number at the counter when you collect your order.
            </p>
            <button onClick={() => go("home")}>Order something else</button>
          </section>
        )}

        {/* ---------------- LOGIN ---------------- */}
        {page === "login" && (
          <section className="panel narrow">
            <h2>Staff login</h2>

            <form onSubmit={staffLogin}>
              <label>
                Username
                <input
                  required
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </label>

              <label>
                Password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </label>

              <button>Sign in</button>
            </form>

            <p className="hint">
              Use the staff username and password set in the backend .env file.
            </p>
          </section>
        )}

        {/* ---------------- STAFF ---------------- */}
        {page === "staff" && staff && (
          <section>
            <div className="section-heading">
              <h2>Management dashboard</h2>
              <button className="secondary" onClick={loadOrders}>
                Refresh orders
              </button>
            </div>

            <div className="stats">
              <div className="stat">
                <span>Today&apos;s revenue</span>
                <strong>{money(todaysTotal)}</strong>
              </div>
              <div className="stat">
                <span>Orders today</span>
                <strong>{todaysOrders.length}</strong>
              </div>
              <div className="stat">
                <span>Still to collect</span>
                <strong>{activeCount}</strong>
              </div>
              <div className="stat">
                <span>Collected today</span>
                <strong>{collectedCount}</strong>
              </div>
              <div className="stat">
                <span>All orders</span>
                <strong>{orders.length}</strong>
              </div>
            </div>

            <div className="panel">
              <h2>{editingId ? "Edit menu item" : "Add a menu item"}</h2>

              <form className="menu-form" onSubmit={saveMenuItem}>
                <label>
                  Item name
                  <input
                    required
                    value={itemForm.name}
                    onChange={e =>
                      setItemForm({ ...itemForm, name: e.target.value })
                    }
                  />
                </label>

                <label>
                  Description
                  <input
                    required
                    value={itemForm.description}
                    onChange={e =>
                      setItemForm({ ...itemForm, description: e.target.value })
                    }
                  />
                </label>

                <label>
                  Price (M)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={itemForm.price}
                    onChange={e =>
                      setItemForm({ ...itemForm, price: e.target.value })
                    }
                  />
                </label>

                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={itemForm.available}
                    onChange={e =>
                      setItemForm({ ...itemForm, available: e.target.checked })
                    }
                  />
                  Available
                </label>

                <button>{editingId ? "Save changes" : "Add item"}</button>

                {editingId && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={cancelEdit}
                  >
                    Cancel edit
                  </button>
                )}
              </form>

              <h3>Current menu</h3>

              {menu.length === 0 && <p className="hint">No menu items yet.</p>}

              {menu.map(item => (
                <div className="admin-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {money(item.price)} •{" "}
                      {item.available ? "Available" : "Unavailable"}
                    </small>
                  </div>

                  <div className="actions">
                    <button
                      className="secondary"
                      onClick={() => toggleAvailability(item)}
                    >
                      {item.available ? "Mark sold out" : "Mark available"}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => beginEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="danger"
                      onClick={() => deleteMenuItem(item)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel">
              <div className="section-heading">
                <h2>Customer orders</h2>
                <span className="hint">
                  Showing {shownOrders.length} of {orders.length}
                </span>
              </div>

              <div className="chips" role="tablist" aria-label="Filter orders">
                {["All", ...statuses].map(s => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === s}
                    className={`chip${statusFilter === s ? " chip-on" : ""}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s}
                    {s !== "All" && (
                      <span className="chip-count">
                        {orders.filter(o => o.status === s).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {shownOrders.length === 0 && (
                <p className="hint">
                  {orders.length === 0
                    ? "No orders have been placed yet."
                    : `No ${statusFilter.toLowerCase()} orders.`}
                </p>
              )}

              {shownOrders.map(order => {
                const next = statuses[statuses.indexOf(order.status) + 1];

                return (
                  <article className="order-card" key={order.id}>
                    <div className="order-head">
                      <div>
                        <strong>{order.orderNumber}</strong>
                        <small>
                          {order.customerName} • {order.customerContact} •{" "}
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </small>
                      </div>
                      <strong>{money(order.total)}</strong>
                    </div>

                    <p>
                      {order.items
                        .map(item => `${item.name} × ${item.quantity}`)
                        .join(", ")}
                    </p>

                    <div className="status-line">
                      <StatusBadge status={order.status} />

                      <div className="actions">
                        {next && (
                          <button onClick={() => updateStatus(order.id, next)}>
                            Mark {next.toLowerCase()}
                          </button>
                        )}
                        <select
                          aria-label={`Status for ${order.orderNumber}`}
                          value={order.status}
                          onChange={e => updateStatus(order.id, e.target.value)}
                        >
                          {statuses.map(status => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {page === "staff" && !staff && (
          <section className="panel">
            <p>Please sign in as staff first.</p>
            <button onClick={() => go("login")}>Go to login</button>
          </section>
        )}
      </main>

      <footer>{BRAND} • Management System</footer>
    </div>
  );
}
