export type IconName =
  | "home"
  | "route"
  | "calendar"
  | "truck"
  | "users"
  | "building"
  | "money"
  | "tool"
  | "file"
  | "alert"
  | "chart"
  | "settings"
  | "plus"
  | "search"
  | "menu"
  | "close"
  | "logout"
  | "wifi"
  | "offline"
  | "chevron"
  | "camera"
  | "gauge"
  | "fuel";

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly strokeWidth?: number;
}

const paths: Readonly<Record<IconName, React.ReactNode>> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18h2.25A7.25 7.25 0 0 0 18 10.75V8.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M15 5.5a3 3 0 0 1 0 5.5M16 14.5A5.5 5.5 0 0 1 21 20" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5l8-3 8 3v16M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" />
    </>
  ),
  money: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 12h.01M17 12h.01" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  tool: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L20 16.4a2.5 2.5 0 1 1-3.6 3.6l-7.7-7.7" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5M9 12h6M9 16h6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.8 20h18.4z" />
      <path d="M12 9v5M12 17.5h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  logout: (
    <>
      <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
    </>
  ),
  wifi: (
    <>
      <path d="M4 9a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M10 17a3 3 0 0 1 4 0" />
      <circle cx="12" cy="20" r=".5" fill="currentColor" />
    </>
  ),
  offline: (
    <>
      <path d="M4 9a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M3 3l18 18" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  camera: (
    <>
      <path d="M4 7h4l2-3h4l2 3h4v13H4z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 19a9 9 0 1 1 16 0" />
      <path d="m12 14 4-5" />
      <circle cx="12" cy="14" r="1" />
    </>
  ),
  fuel: (
    <>
      <path d="M5 21V4h10v17M3 21h14M8 8h4" />
      <path d="M15 8h2l3 3v7a2 2 0 0 1-4 0v-4" />
    </>
  ),
};

export function Icon({ name, size = 20, strokeWidth = 1.8 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      {paths[name]}
    </svg>
  );
}
