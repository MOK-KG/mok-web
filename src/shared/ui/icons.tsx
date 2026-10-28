// Набор иконок из макета Figma («единый набор 1.7 stroke»), сгенерирован из SVG.
// Геометрия как в макете; цвет линии — currentColor, чтобы иконка брала цвет текста.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function icon(viewBox: number, body: string) {
  return function Icon({ size = viewBox, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        fill="none"
        aria-hidden
        // biome-ignore lint/security/noDangerouslySetInnerHtml: статичная разметка иконок из макета
        dangerouslySetInnerHTML={{ __html: body }}
        {...rest}
      />
    );
  };
}

export const EmblemIcon = icon(
  18,
  `<path d="M9 15.3C12.4794 15.3 15.3 12.4794 15.3 9C15.3 5.52061 12.4794 2.7 9 2.7C5.52061 2.7 2.7 5.52061 2.7 9C2.7 12.4794 5.52061 15.3 9 15.3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 2.7V15.3M2.7 9H15.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const DashboardIcon = icon(
  18,
  `<path d="M3 7.875L9 3L15 7.875V15H3V7.875Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.125 15V10.5H10.875V15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const TasksIcon = icon(
  18,
  `<path d="M5.475 3.375H3.525C3.02794 3.375 2.625 3.77794 2.625 4.275V13.725C2.625 14.2221 3.02794 14.625 3.525 14.625H5.475C5.97206 14.625 6.375 14.2221 6.375 13.725V4.275C6.375 3.77794 5.97206 3.375 5.475 3.375Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.35 3.375H8.4C7.90294 3.375 7.5 3.77794 7.5 4.275V9.975C7.5 10.4721 7.90294 10.875 8.4 10.875H10.35C10.8471 10.875 11.25 10.4721 11.25 9.975V4.275C11.25 3.77794 10.8471 3.375 10.35 3.375Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.475 3.375H13.275C12.7779 3.375 12.375 3.77794 12.375 4.275V6.975C12.375 7.47206 12.7779 7.875 13.275 7.875H14.475C14.9721 7.875 15.375 7.47206 15.375 6.975V4.275C15.375 3.77794 14.9721 3.375 14.475 3.375Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CalendarIcon = icon(
  18,
  `<path d="M13.875 3.75H4.125C3.29657 3.75 2.625 4.42157 2.625 5.25V13.5C2.625 14.3284 3.29657 15 4.125 15H13.875C14.7034 15 15.375 14.3284 15.375 13.5V5.25C15.375 4.42157 14.7034 3.75 13.875 3.75Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.625 7.5H15.375M6 2.25V5.25M12 2.25V5.25" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ChatIcon = icon(
  18,
  `<path d="M15 9C15 10.3924 14.4469 11.7277 13.4623 12.7123C12.4777 13.6969 11.1424 14.25 9.75 14.25H6.75L3.75 16.5V13.125C2.9069 12.4636 2.2864 11.5599 1.97185 10.5355C1.6573 9.51115 1.66375 8.41503 1.99035 7.39441C2.31695 6.37379 2.94805 5.47756 3.79888 4.82609C4.64971 4.17461 5.67952 3.79911 6.75 3.75H9.75C11.1424 3.75 12.4777 4.30312 13.4623 5.28769C14.4469 6.27226 15 7.60761 15 9Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const KnowledgeIcon = icon(
  18,
  `<path d="M3.75 3.375C3.75 3.07663 3.86853 2.79048 4.0795 2.5795C4.29048 2.36853 4.57663 2.25 4.875 2.25H14.25V15.75H4.875C4.57663 15.75 4.29048 15.6315 4.0795 15.4205C3.86853 15.2095 3.75 14.9234 3.75 14.625V3.375Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.75 2.25V15.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const DocumentsIcon = icon(
  18,
  `<path d="M4.875 2.25H10.125L13.875 6V15.75H4.875V2.25Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.125 2.25V6H13.875" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.75 9.75H12M6.75 12.75H10.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const FilesIcon = icon(
  18,
  `<path d="M6 2.25H12L15.75 8.25L12.75 13.5H5.25L2.25 8.25L6 2.25Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 2.25L5.25 8.25H12.75L12 2.25" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const AccessIcon = icon(
  18,
  `<path d="M9 2.625L14.625 4.725V8.775C14.625 12.225 12.225 14.325 9 15C5.775 14.325 3.375 12.225 3.375 8.775V4.725L9 2.625Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.125 9L8.625 10.5L11.25 7.875" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const SidebarCollapseIcon = icon(
  18,
  `<path d="M14.1 3.375H3.9C2.98873 3.375 2.25 4.11373 2.25 5.025V12.975C2.25 13.8863 2.98873 14.625 3.9 14.625H14.1C15.0113 14.625 15.75 13.8863 15.75 12.975V5.025C15.75 4.11373 15.0113 3.375 14.1 3.375Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.9 3.375V14.625" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.375 7.125L10.5 9L12.375 10.875" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const SidebarExpandIcon = icon(
  18,
  `<path d="M14.1 3.375H3.9C2.98873 3.375 2.25 4.11373 2.25 5.025V12.975C2.25 13.8863 2.98873 14.625 3.9 14.625H14.1C15.0113 14.625 15.75 13.8863 15.75 12.975V5.025C15.75 4.11373 15.0113 3.375 14.1 3.375Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.9 3.375V14.625" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.125 7.125L12 9L10.125 10.875" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ChevronDownIcon = icon(
  13,
  `<path d="M3.25 5.14583L6.5 8.125L9.75 5.14583" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MoonIcon = icon(
  16,
  `<path d="M13.3333 9.66667C12.3625 9.94258 11.3357 9.95423 10.3589 9.70039C9.3821 9.44656 8.49082 8.93646 7.77718 8.22282C7.06354 7.50918 6.55344 6.6179 6.29961 5.64111C6.04577 4.66432 6.05742 3.63745 6.33333 2.66667C5.38351 2.93663 4.52071 3.4501 3.83044 4.1562C3.14017 4.8623 2.64639 5.73652 2.39804 6.69222C2.14969 7.64793 2.15538 8.65194 2.41455 9.60477C2.67373 10.5576 3.17738 11.4262 3.87561 12.1244C4.57384 12.8226 5.44241 13.3263 6.39523 13.5854C7.34806 13.8446 8.35207 13.8503 9.30778 13.602C10.2635 13.3536 11.1377 12.8598 11.8438 12.1696C12.5499 11.4793 13.0634 10.6165 13.3333 9.66667Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CheckDoubleIcon = icon(
  14,
  `<path d="M1.16667 7.29167L3.5 9.625L8.16667 4.66667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.41667 8.75L7.29167 9.625L12.25 4.66667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CheckIcon = icon(
  14,
  `<path d="M2.91667 7.29167L5.54167 9.91667L11.0833 4.375" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const BoltIcon = icon(
  16,
  `<path d="M8.66667 1.33333L2.66667 9.33333H6.66667L6 14.6667L12 6.66667H8L8.66667 1.33333Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ClockIcon = icon(
  16,
  `<path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4.66667V8L10.6667 9.33333" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MailIcon = icon(
  16,
  `<path d="M12.6667 3.33333H3.33333C2.59695 3.33333 2 3.93029 2 4.66667V11.3333C2 12.0697 2.59695 12.6667 3.33333 12.6667H12.6667C13.403 12.6667 14 12.0697 14 11.3333V4.66667C14 3.93029 13.403 3.33333 12.6667 3.33333Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 4.66667L8 8.66667L14 4.66667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const AtSignIcon = icon(
  16,
  `<path d="M8 10.6667C9.47276 10.6667 10.6667 9.47276 10.6667 8C10.6667 6.52724 9.47276 5.33333 8 5.33333C6.52724 5.33333 5.33333 6.52724 5.33333 8C5.33333 9.47276 6.52724 10.6667 8 10.6667Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.6667 5.33333V8.66667C10.6667 9.1971 10.8774 9.70581 11.2525 10.0809C11.6275 10.456 12.1362 10.6667 12.6667 10.6667C13.1971 10.6667 13.7058 10.456 14.0809 10.0809C14.456 9.70581 14.6667 9.1971 14.6667 8.66667V8C14.6855 6.64139 14.2426 5.31663 13.4105 4.2425C12.5784 3.16836 11.4063 2.40846 10.0861 2.08714C8.76594 1.76582 7.37578 1.90212 6.14312 2.47372C4.91047 3.04532 3.90832 4.01838 3.30068 5.23367C2.69303 6.44896 2.51587 7.83452 2.79818 9.1636C3.08049 10.4927 3.80556 11.6866 4.85473 12.55C5.9039 13.4133 7.21505 13.895 8.57362 13.9162C9.93219 13.9374 11.2577 13.4969 12.3333 12.6667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CheckSmallIcon = icon(
  16,
  `<path d="M3.33333 8.33333L6.33333 11.3333L12.6667 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const SettingsIcon = icon(
  16,
  `<path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.9333 10C12.8349 10.2066 12.8013 10.4382 12.837 10.6643C12.8727 10.8904 12.976 11.1004 13.1333 11.2667L13.2 11.3333C13.3528 11.448 13.4792 11.5941 13.5707 11.7618C13.6621 11.9295 13.7164 12.1149 13.73 12.3055C13.7435 12.496 13.716 12.6873 13.6492 12.8662C13.5824 13.0452 13.4779 13.2077 13.3428 13.3428C13.2077 13.4779 13.0452 13.5824 12.8662 13.6492C12.6873 13.716 12.496 13.7435 12.3055 13.73C12.1149 13.7164 11.9295 13.6621 11.7618 13.5707C11.5941 13.4792 11.448 13.3528 11.3333 13.2L11.2667 13.1333C11.1004 12.976 10.8904 12.8727 10.6643 12.837C10.4382 12.8013 10.2066 12.8349 10 12.9333C9.8063 13.0207 9.64108 13.1609 9.5232 13.3377C9.40531 13.5145 9.33952 13.7209 9.33333 13.9333V14C9.33333 14.3536 9.19286 14.6928 8.94281 14.9428C8.69276 15.1929 8.35362 15.3333 8 15.3333C7.64638 15.3333 7.30724 15.1929 7.05719 14.9428C6.80714 14.6928 6.66667 14.3536 6.66667 14V13.9333C6.65481 13.7134 6.57914 13.5017 6.4489 13.3241C6.31867 13.1465 6.13951 13.0107 5.93333 12.9333C5.7267 12.8349 5.49509 12.8013 5.26899 12.837C5.04289 12.8727 4.83291 12.976 4.66667 13.1333L4.6 13.2C4.48538 13.3528 4.33926 13.4792 4.17154 13.5707C4.00382 13.6621 3.8184 13.7164 3.62785 13.73C3.4373 13.7435 3.24607 13.716 3.0671 13.6492C2.88813 13.5824 2.7256 13.4779 2.59052 13.3428C2.45545 13.2077 2.35097 13.0452 2.28417 12.8662C2.21737 12.6873 2.18981 12.496 2.20335 12.3055C2.2169 12.1149 2.27123 11.9295 2.36266 11.7618C2.4541 11.5941 2.58051 11.448 2.73333 11.3333L2.8 11.2667C2.95735 11.1004 3.06068 10.8904 3.09638 10.6643C3.13208 10.4382 3.09848 10.2066 3 10C2.91258 9.8063 2.77247 9.64108 2.59565 9.5232C2.41883 9.40531 2.21242 9.33952 2 9.33333C1.64638 9.33333 1.30724 9.19286 1.05719 8.94281C0.807143 8.69276 0.666667 8.35362 0.666667 8C0.666667 7.64638 0.807143 7.30724 1.05719 7.05719C1.30724 6.80714 1.64638 6.66667 2 6.66667H2.06667C2.28658 6.65481 2.49827 6.57914 2.67586 6.4489C2.85346 6.31867 2.98926 6.13951 3.06667 5.93333C3.16514 5.7267 3.19874 5.49509 3.16304 5.26899C3.12734 5.04289 3.02402 4.83291 2.86667 4.66667L2.8 4.6C2.64718 4.48538 2.52077 4.33926 2.42933 4.17154C2.33789 4.00382 2.28356 3.8184 2.27002 3.62785C2.25648 3.4373 2.28404 3.24607 2.35084 3.0671C2.41764 2.88813 2.52211 2.7256 2.65719 2.59052C2.79227 2.45545 2.9548 2.35097 3.13377 2.28417C3.31274 2.21737 3.50397 2.18981 3.69452 2.20335C3.88507 2.2169 4.07048 2.27123 4.23821 2.36266C4.40593 2.4541 4.55205 2.58051 4.66667 2.73333L4.73333 2.8C4.89957 2.95735 5.10956 3.06068 5.33566 3.09638C5.56176 3.13208 5.79337 3.09848 6 3H6.66667C6.86037 2.91258 7.02559 2.77247 7.14347 2.59565C7.26135 2.41883 7.32714 2.21242 7.33333 2C7.33333 1.64638 7.47381 1.30724 7.72386 1.05719C7.97391 0.807143 8.31304 0.666667 8.66667 0.666667C9.02029 0.666667 9.35943 0.807143 9.60948 1.05719C9.85952 1.30724 10 1.64638 10 2V2.06667C10.0062 2.27909 10.072 2.48549 10.1899 2.66231C10.3077 2.83914 10.473 2.97925 10.6667 3.06667C10.8733 3.16514 11.1049 3.19874 11.331 3.16304C11.5571 3.12734 11.7671 3.02402 11.9333 2.86667L12 2.8C12.1146 2.64718 12.2607 2.52077 12.4285 2.42933C12.5962 2.33789 12.7816 2.28356 12.9721 2.27002C13.1627 2.25648 13.3539 2.28404 13.5329 2.35084C13.7119 2.41764 13.8744 2.52211 14.0095 2.65719C14.1446 2.79227 14.249 2.9548 14.3158 3.13377C14.3826 3.31274 14.4102 3.50397 14.3966 3.69452C14.3831 3.88507 14.3288 4.07048 14.2373 4.23821C14.1459 4.40593 14.0195 4.55205 13.8667 4.66667L13.8 4.73333C13.6426 4.89957 13.5393 5.10956 13.5036 5.33566C13.4679 5.56176 13.5015 5.79337 13.6 6V6.66667C13.6874 6.86037 13.8275 7.02559 14.0044 7.14347C14.1812 7.26135 14.3876 7.32714 14.6 7.33333H14C14.3536 7.33333 14.6928 7.47381 14.9428 7.72386C15.1929 7.97391 15.3333 8.31304 15.3333 8.66667C15.3333 9.02029 15.1929 9.35943 14.9428 9.60948C14.6928 9.85952 14.3536 10 14 10H13.9333C13.7209 10.0062 13.5145 10.072 13.3377 10.1899C13.1609 10.3077 13.0207 10.473 12.9333 10.6667V10Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const BellIcon = icon(
  16,
  `<g transform="translate(-8 -8)"><path d="M20 18.3333V14.6667C20 13.6058 19.5786 12.5884 18.8284 11.8382C18.0783 11.0881 17.0609 10.6667 16 10.6667C14.9391 10.6667 13.9217 11.0881 13.1716 11.8382C12.4214 12.5884 12 13.6058 12 14.6667V18.3333L10.6667 20.3333H21.3333L20 18.3333Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.6667 22.3333H17.3333" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`,
);
export const PlusIcon = icon(
  16,
  `<path d="M8 3.33333V12.6667M3.33333 8H12.6667" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const FilterIcon = icon(
  16,
  `<path d="M2.33333 3.33333H13.6667L9.33333 8.66667V12.6667L6.66667 11.3333V8.66667L2.33333 3.33333Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const SearchIcon = icon(
  16,
  `<path d="M7.33333 12C9.91066 12 12 9.91066 12 7.33333C12 4.756 9.91066 2.66667 7.33333 2.66667C4.756 2.66667 2.66667 4.756 2.66667 7.33333C2.66667 9.91066 4.756 12 7.33333 12Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.8 10.8L14 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const GroupIcon = icon(
  16,
  `<path d="M6 3.33333H3.33333C2.96514 3.33333 2.66667 3.63181 2.66667 4V6.66667C2.66667 7.03486 2.96514 7.33333 3.33333 7.33333H6C6.36819 7.33333 6.66667 7.03486 6.66667 6.66667V4C6.66667 3.63181 6.36819 3.33333 6 3.33333Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.6667 3.33333H10C9.63181 3.33333 9.33333 3.63181 9.33333 4V6.66667C9.33333 7.03486 9.63181 7.33333 10 7.33333H12.6667C13.0349 7.33333 13.3333 7.03486 13.3333 6.66667V4C13.3333 3.63181 13.0349 3.33333 12.6667 3.33333Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9.33333H3.33333C2.96514 9.33333 2.66667 9.63181 2.66667 10V12C2.66667 12.3682 2.96514 12.6667 3.33333 12.6667H6C6.36819 12.6667 6.66667 12.3682 6.66667 12V10C6.66667 9.63181 6.36819 9.33333 6 9.33333Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.6667 9.33333H10C9.63181 9.33333 9.33333 9.63181 9.33333 10V12C9.33333 12.3682 9.63181 12.6667 10 12.6667H12.6667C13.0349 12.6667 13.3333 12.3682 13.3333 12V10C13.3333 9.63181 13.0349 9.33333 12.6667 9.33333Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MailLargeIcon = icon(
  18,
  `<path d="M14.25 3.75H3.75C2.92157 3.75 2.25 4.42157 2.25 5.25V12.75C2.25 13.5784 2.92157 14.25 3.75 14.25H14.25C15.0784 14.25 15.75 13.5784 15.75 12.75V5.25C15.75 4.42157 15.0784 3.75 14.25 3.75Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.25 5.25L9 9.75L15.75 5.25" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ArrowRightIcon = icon(
  14,
  `<path d="M2.91667 7H11.0833M7.58333 10.5L11.0833 7L7.58333 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const LogoutIcon = icon(
  18,
  `<path d="M6.75 15.375H4.125C3.29657 15.375 2.625 14.7034 2.625 13.875V4.125C2.625 3.29657 3.29657 2.625 4.125 2.625H6.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12.75L15.75 9L12 5.25M15.75 9H6.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MailSmallIcon = icon(
  12,
  `<path d="M9.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V8.5C1.5 9.05228 1.94772 9.5 2.5 9.5H9.5C10.0523 9.5 10.5 9.05228 10.5 8.5V3.5C10.5 2.94772 10.0523 2.5 9.5 2.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.5 3.5L6 6.5L10.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const PaperclipIcon = icon(
  12,
  `<path d="M10.5 5.5L6 10C5.51857 10.3611 4.92305 10.5364 4.32278 10.4937C3.7225 10.4511 3.15776 10.1933 2.73223 9.76777C2.3067 9.34224 2.04895 8.7775 2.00629 8.17722C1.96363 7.57695 2.13893 6.98143 2.5 6.5L7 2C7.33152 1.66848 7.78116 1.48223 8.25 1.48223C8.71884 1.48223 9.16848 1.66848 9.5 2C9.83152 2.33152 10.0178 2.78116 10.0178 3.25C10.0178 3.71884 9.83152 4.16848 9.5 4.5L5 9C4.80109 9.19891 4.5313 9.31066 4.25 9.31066C3.9687 9.31066 3.69891 9.19891 3.5 9C3.30109 8.80109 3.18934 8.5313 3.18934 8.25C3.18934 7.9687 3.30109 7.69891 3.5 7.5L7.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const RescheduleIcon = icon(
  12,
  `<path d="M6 10.5C8.48528 10.5 10.5 8.48528 10.5 6C10.5 3.51472 8.48528 1.5 6 1.5C3.51472 1.5 1.5 3.51472 1.5 6C1.5 8.48528 3.51472 10.5 6 10.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 3.5V6L8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const SubtasksIcon = icon(
  12,
  `<path d="M2 3H10M2 6H7M2 9H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CommentIcon = icon(
  12,
  `<path d="M2 2.5H10V8H4.5L2 10V2.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const BoltSmallIcon = icon(
  13,
  `<path d="M7.04167 1.08333L2.16667 7.58333H5.41667L4.875 11.9167L9.75 5.41667H6.5L7.04167 1.08333Z" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const PlaneIcon = icon(
  13,
  `<path d="M1.08333 6.5L11.9167 2.16667L7.58333 13L6.5 8.66667L1.08333 6.5Z" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CheckboxCheckIcon = icon(
  11,
  `<path d="M2.29167 5.72917L4.35417 7.79167L8.70833 3.4375" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CloseIcon = icon(
  15,
  `<path d="M3.75 3.75L11.25 11.25M11.25 3.75L3.75 11.25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CloseSmallIcon = icon(
  11,
  `<path d="M2.75 2.75L8.25 8.25M8.25 2.75L2.75 8.25" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const XIcon = icon(
  16,
  `<path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MoreIcon = icon(
  16,
  `<path d="M3.33333 8.93333C3.8488 8.93333 4.26667 8.51547 4.26667 8C4.26667 7.48453 3.8488 7.06667 3.33333 7.06667C2.81787 7.06667 2.4 7.48453 2.4 8C2.4 8.51547 2.81787 8.93333 3.33333 8.93333Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8.93333C8.51547 8.93333 8.93333 8.51547 8.93333 8C8.93333 7.48453 8.51547 7.06667 8 7.06667C7.48453 7.06667 7.06667 7.48453 7.06667 8C7.06667 8.51547 7.48453 8.93333 8 8.93333Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.6667 8.93333C13.1821 8.93333 13.6 8.51547 13.6 8C13.6 7.48453 13.1821 7.06667 12.6667 7.06667C12.1512 7.06667 11.7333 7.48453 11.7333 8C11.7333 8.51547 12.1512 8.93333 12.6667 8.93333Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const BoltMediumIcon = icon(
  17,
  `<path d="M9.20833 1.41667L2.83333 9.91667H7.08333L6.375 15.5833L12.75 7.08333H8.5L9.20833 1.41667Z" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const BookIcon = icon(
  17,
  `<path d="M3.54167 3.1875C3.54167 2.90571 3.65361 2.63546 3.85287 2.4362C4.05212 2.23694 4.32237 2.125 4.60417 2.125H13.4583V14.875H4.60417C4.32237 14.875 4.05212 14.7631 3.85287 14.5638C3.65361 14.3645 3.54167 14.0943 3.54167 13.8125V3.1875Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.375 2.125V14.875" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ExternalIcon = icon(
  15,
  `<path d="M3.125 7.5H11.875M8.125 11.25L11.875 7.5L8.125 3.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CheckTinyIcon = icon(
  12,
  `<path d="M2.5 6.25L4.75 8.5L9.5 3.75" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const PlusSmallIcon = icon(
  14,
  `<path d="M7 2.91667V11.0833M2.91667 7H11.0833" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const AttachMediumIcon = icon(
  16,
  `<path d="M14 7.33333L8 13.3333C7.35809 13.8148 6.56407 14.0485 5.7637 13.9916C4.96334 13.9347 4.21035 13.5911 3.64298 13.0237C3.07561 12.4563 2.73193 11.7033 2.67505 10.903C2.61817 10.1026 2.8519 9.30857 3.33333 8.66667L9.33333 2.66667C9.77536 2.22464 10.3749 1.97631 11 1.97631C11.6251 1.97631 12.2246 2.22464 12.6667 2.66667C13.1087 3.10869 13.357 3.70821 13.357 4.33333C13.357 4.95845 13.1087 5.55797 12.6667 6L6.66667 12C6.40145 12.2652 6.04174 12.4142 5.66667 12.4142C5.29159 12.4142 4.93188 12.2652 4.66667 12C4.40145 11.7348 4.25245 11.3751 4.25245 11C4.25245 10.6249 4.40145 10.2652 4.66667 10L10 4.66667" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const SendIcon = icon(
  16,
  `<path d="M2.66667 8L13.3333 2.66667L9.33333 8L13.3333 13.3333L2.66667 8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const PlaneMediumIcon = icon(
  15,
  `<path d="M1.25 7.5L13.75 2.5L8.75 15L7.5 10L1.25 7.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MovesIcon = icon(
  15,
  `<path d="M7.5 13.125C10.6066 13.125 13.125 10.6066 13.125 7.5C13.125 4.3934 10.6066 1.875 7.5 1.875C4.3934 1.875 1.875 4.3934 1.875 7.5C1.875 10.6066 4.3934 13.125 7.5 13.125Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 4.375V7.5L10 8.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const BellSmallIcon = icon(
  15,
  `<path d="M11.25 9.6875V6.25C11.25 5.25544 10.8549 4.30161 10.1517 3.59835C9.44839 2.89509 8.49456 2.5 7.5 2.5C6.50544 2.5 5.55161 2.89509 4.84835 3.59835C4.14509 4.30161 3.75 5.25544 3.75 6.25V9.6875L2.5 11.5625H12.5L11.25 9.6875Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.25 13.4375H8.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const EditIcon = icon(
  14,
  `<path d="M3.5 5.54167L7 8.75L10.5 5.54167" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MailMediumIcon = icon(
  14,
  `<path d="M11.0833 2.91667H2.91667C2.27233 2.91667 1.75 3.439 1.75 4.08333V9.91667C1.75 10.561 2.27233 11.0833 2.91667 11.0833H11.0833C11.7277 11.0833 12.25 10.561 12.25 9.91667V4.08333C12.25 3.439 11.7277 2.91667 11.0833 2.91667Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.75 4.08333L7 7.58333L12.25 4.08333" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const HistoryBoltIcon = icon(
  13,
  `<path d="M7.04167 1.08333L2.16667 7.58333H5.41667L4.875 11.9167L9.75 5.41667H6.5L7.04167 1.08333Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const HistorySwapIcon = icon(
  13,
  `<path d="M3.79167 2.16667L1.625 4.33333L3.79167 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.625 4.33333H8.66667C9.2413 4.33333 9.7924 4.56161 10.1987 4.96794C10.6051 5.37426 10.8333 5.92536 10.8333 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.20833 10.8333L11.375 8.66667L9.20833 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.375 8.66667H4.33333C3.7587 8.66667 3.2076 8.43839 2.80127 8.03206C2.39494 7.62574 2.16667 7.07464 2.16667 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const HistoryClockIcon = icon(
  13,
  `<path d="M6.5 11.375C9.19239 11.375 11.375 9.19239 11.375 6.5C11.375 3.80761 9.19239 1.625 6.5 1.625C3.80761 1.625 1.625 3.80761 1.625 6.5C1.625 9.19239 3.80761 11.375 6.5 11.375Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 3.79167V6.5L8.66667 7.58333" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const HistoryMailIcon = icon(
  13,
  `<path d="M10.2917 2.70833H2.70833C2.11002 2.70833 1.625 3.19336 1.625 3.79167V9.20833C1.625 9.80664 2.11002 10.2917 2.70833 10.2917H10.2917C10.89 10.2917 11.375 9.80664 11.375 9.20833V3.79167C11.375 3.19336 10.89 2.70833 10.2917 2.70833Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.625 3.79167L6.5 7.04167L11.375 3.79167" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const DuplicateIcon = icon(
  16,
  `<path d="M12 5.33333H6.66667C5.93029 5.33333 5.33333 5.93029 5.33333 6.66667V12C5.33333 12.7364 5.93029 13.3333 6.66667 13.3333H12C12.7364 13.3333 13.3333 12.7364 13.3333 12V6.66667C13.3333 5.93029 12.7364 5.33333 12 5.33333Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.6667 5.33333V4C10.6667 3.64638 10.5262 3.30724 10.2761 3.05719C10.0261 2.80714 9.68696 2.66667 9.33333 2.66667H4C3.64638 2.66667 3.30724 2.80714 3.05719 3.05719C2.80714 3.30724 2.66667 3.64638 2.66667 4V9.33333C2.66667 9.68696 2.80714 10.0261 3.05719 10.2761C3.30724 10.5262 3.64638 10.6667 4 10.6667H5.33333" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ArrowSmallIcon = icon(
  13,
  `<path d="M2.70833 6.5H10.2917M7.04167 9.75L10.2917 6.5L7.04167 3.25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ChevronSmallIcon = icon(
  14,
  `<path d="M3.5 5.54167L7 8.75L10.5 5.54167" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CalendarMediumIcon = icon(
  17,
  `<path d="M13.1042 3.54167H3.89583C3.11343 3.54167 2.47917 4.17593 2.47917 4.95833V12.75C2.47917 13.5324 3.11343 14.1667 3.89583 14.1667H13.1042C13.8866 14.1667 14.5208 13.5324 14.5208 12.75V4.95833C14.5208 4.17593 13.8866 3.54167 13.1042 3.54167Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.47917 7.08333H14.5208M5.66667 2.125V4.95833M11.3333 2.125V4.95833" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const AttachLargeIcon = icon(
  17,
  `<path d="M14.875 7.79167L8.5 14.1667C7.81797 14.6782 6.97432 14.9265 6.12393 14.8661C5.27355 14.8057 4.4735 14.4405 3.87066 13.8377C3.26783 13.2348 2.90268 12.4348 2.84224 11.5844C2.78181 10.734 3.03015 9.89036 3.54167 9.20833L9.91667 2.83333C10.3863 2.36368 11.0233 2.09983 11.6875 2.09983C12.3517 2.09983 12.9887 2.36368 13.4583 2.83333C13.928 3.30299 14.1918 3.93998 14.1918 4.60417C14.1918 5.26836 13.928 5.90535 13.4583 6.375L7.08333 12.75C6.80154 13.0318 6.41935 13.1901 6.02083 13.1901C5.62232 13.1901 5.24013 13.0318 4.95833 12.75C4.67654 12.4682 4.51823 12.086 4.51823 11.6875C4.51823 11.289 4.67654 10.9068 4.95833 10.625L10.625 4.95833" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const PlusMediumIcon = icon(
  17,
  `<path d="M8.5 3.54167V13.4583M3.54167 8.5H13.4583" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MenuIcon = icon(
  16,
  `<path d="M2.66667 4H13.3333M2.66667 8H13.3333M2.66667 12H13.3333" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MailHugeIcon = icon(
  20,
  `<path d="M15.8333 4.16667H4.16667C3.24619 4.16667 2.5 4.91286 2.5 5.83333V14.1667C2.5 15.0871 3.24619 15.8333 4.16667 15.8333H15.8333C16.7538 15.8333 17.5 15.0871 17.5 14.1667V5.83333C17.5 4.91286 16.7538 4.16667 15.8333 4.16667Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 5.83333L10 10.8333L17.5 5.83333" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const MailLetterIcon = icon(
  15,
  `<path d="M11.875 3.125H3.125C2.43464 3.125 1.875 3.68464 1.875 4.375V10.625C1.875 11.3154 2.43464 11.875 3.125 11.875H11.875C12.5654 11.875 13.125 11.3154 13.125 10.625V4.375C13.125 3.68464 12.5654 3.125 11.875 3.125Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.875 4.375L7.5 8.125L13.125 4.375" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CheckMiniIcon = icon(
  11,
  `<path d="M2.29167 5.72917L4.35417 7.79167L8.70833 3.4375" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const AlertMiniIcon = icon(
  11,
  `<path d="M5.5 1.83333L9.625 9.16667H1.375L5.5 1.83333Z" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 4.58333V6.41667M5.5 7.79167H5.50458" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const FileIcon = icon(
  15,
  `<path d="M13.125 6.875L7.5 12.5C6.89821 12.9513 6.15381 13.1705 5.40347 13.1171C4.65313 13.0638 3.9472 12.7416 3.41529 12.2097C2.88338 11.6778 2.56119 10.9719 2.50786 10.2215C2.45454 9.47119 2.67366 8.72679 3.125 8.125L8.75 2.5C9.1644 2.0856 9.72645 1.85279 10.3125 1.85279C10.8986 1.85279 11.4606 2.0856 11.875 2.5C12.2894 2.9144 12.5222 3.47645 12.5222 4.0625C12.5222 4.64855 12.2894 5.2106 11.875 5.625L6.25 11.25C6.00136 11.4986 5.66413 11.6383 5.3125 11.6383C4.96087 11.6383 4.62364 11.4986 4.375 11.25C4.12636 11.0014 3.98667 10.6641 3.98667 10.3125C3.98667 9.96087 4.12636 9.62364 4.375 9.375L9.375 4.375" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const SparkleIcon = icon(
  14,
  `<path d="M7 1.75L8.05 4.78333L11.0833 5.83333L8.05 6.88333L7 9.91667L5.95 6.88333L2.91667 5.83333L5.95 4.78333L7 1.75Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const EditMediumIcon = icon(
  16,
  `<path d="M2.66667 13.3333H5.33333L13.3333 5.33333L10.6667 2.66667L2.66667 10.6667V13.3333Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const RejectIcon = icon(
  17,
  `<path d="M4.25 4.25L12.75 12.75M12.75 4.25L4.25 12.75" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ClearIcon = icon(
  12,
  `<path d="M3 3L6 6M6 6L9 9M6 6L9 3M6 6L3 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ShieldCheckIcon = icon(
  16,
  `<path d="M8 2.33333L13 4.2V7.8C13 10.8667 10.8667 12.7333 8 13.3333C5.13333 12.7333 3 10.8667 3 7.8V4.2L8 2.33333Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.33333 8L7.66667 9.33333L10 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const FolderIcon = icon(
  17,
  `<path d="M2.125 4.95833C2.125 4.58261 2.27426 4.22228 2.53993 3.9566C2.80561 3.69092 3.16594 3.54167 3.54167 3.54167H6.375L7.79167 4.95833H13.4583C13.8341 4.95833 14.1944 5.10759 14.4601 5.37327C14.7257 5.63894 14.875 5.99928 14.875 6.375V12.0417C14.875 12.4174 14.7257 12.7777 14.4601 13.0434C14.1944 13.3091 13.8341 13.4583 13.4583 13.4583H3.54167C3.16594 13.4583 2.80561 13.3091 2.53993 13.0434C2.27426 12.7777 2.125 12.4174 2.125 12.0417V4.95833Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const LockIcon = icon(
  17,
  `<path d="M4.60417 7.4375H12.3958C13.1782 7.4375 13.8125 8.07176 13.8125 8.85417V13.1042C13.8125 13.8866 13.1782 14.5208 12.3958 14.5208H4.60417C3.82176 14.5208 3.1875 13.8866 3.1875 13.1042V8.85417C3.1875 8.07176 3.82176 7.4375 4.60417 7.4375Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.66667 7.4375V4.95833C5.66667 4.20689 5.96518 3.48622 6.49653 2.95486C7.02788 2.42351 7.74855 2.125 8.5 2.125C9.25145 2.125 9.97212 2.42351 10.5035 2.95486C11.0348 3.48622 11.3333 4.20689 11.3333 4.95833V7.4375" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const TasksMiniIcon = icon(
  13,
  `<path d="M2.54583 2.4375H3.95417C4.31315 2.4375 4.60417 2.72851 4.60417 3.0875V9.9125C4.60417 10.2715 4.31315 10.5625 3.95417 10.5625H2.54583C2.18685 10.5625 1.89583 10.2715 1.89583 9.9125V3.0875C1.89583 2.72851 2.18685 2.4375 2.54583 2.4375Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.06667 2.4375H7.475C7.83398 2.4375 8.125 2.72851 8.125 3.0875V7.20417C8.125 7.56315 7.83398 7.85417 7.475 7.85417H6.06667C5.70768 7.85417 5.41667 7.56315 5.41667 7.20417V3.0875C5.41667 2.72851 5.70768 2.4375 6.06667 2.4375Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5875 2.4375H10.4542C10.8132 2.4375 11.1042 2.72851 11.1042 3.0875V5.0375C11.1042 5.39649 10.8132 5.6875 10.4542 5.6875H9.5875C9.22852 5.6875 8.9375 5.39649 8.9375 5.0375V3.0875C8.9375 2.72851 9.22852 2.4375 9.5875 2.4375Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const DocMiniIcon = icon(
  13,
  `<path d="M3.52083 1.625H7.3125L10.0208 4.33333V11.375H3.52083V1.625Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.3125 1.625V4.33333H10.0208" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const ChevronLeftIcon = icon(
  16,
  `<path d="M10 4L6 8L10 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const CheckBadgeIcon = icon(
  12,
  `<path d="M2.5 6.25L4.75 8.5L9.5 3.75" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const TasksSmallIcon = icon(
  14,
  `<path d="M2.74167 2.625H4.25833C4.64493 2.625 4.95833 2.9384 4.95833 3.325V10.675C4.95833 11.0616 4.64493 11.375 4.25833 11.375H2.74167C2.35507 11.375 2.04167 11.0616 2.04167 10.675V3.325C2.04167 2.9384 2.35507 2.625 2.74167 2.625Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.53333 2.625H8.05C8.4366 2.625 8.75 2.9384 8.75 3.325V7.75833C8.75 8.14493 8.4366 8.45833 8.05 8.45833H6.53333C6.14673 8.45833 5.83333 8.14493 5.83333 7.75833V3.325C5.83333 2.9384 6.14673 2.625 6.53333 2.625Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.325 2.625H11.2583C11.6449 2.625 11.9583 2.9384 11.9583 3.325V5.425C11.9583 5.8116 11.6449 6.125 11.2583 6.125H10.325C9.9384 6.125 9.625 5.8116 9.625 5.425V3.325C9.625 2.9384 9.9384 2.625 10.325 2.625Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const DocSmallIcon = icon(
  14,
  `<path d="M3.79167 1.75H7.875L10.7917 4.66667V12.25H3.79167V1.75Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.875 1.75V4.66667H10.7917" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const DownloadIcon = icon(
  16,
  `<path d="M8 2.75V10.25M4.75 7L8 10.25L11.25 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 13.25H13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
);
