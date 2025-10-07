// Minimal, crisp, no external deps
import React from "react";

type P = React.SVGProps<SVGSVGElement> & { size?: number; };
const S = ({ size=18, ...p }: P) => <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}/>;

export const IconHome = (p: P) => (
  <S {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></S>
);
export const IconSettings = (p: P) => (
  <S {...p}><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a7.7 7.7 0 0 0 .1-2l2-1.5-2-3.5-2.3.6a7.3 7.3 0 0 0-1.7-1l-.3-2.4H9.8l-.3 2.4a7.3 7.3 0 0 0-1.7 1L5.5 8l-2 3.5L5.4 13a7.7 7.7 0 0 0 .1 2l-1.9 1.5 2 3.5 2.3-.6c.5.4 1.1.7 1.7 1l.3 2.4h4.2l.3-2.4c.6-.3 1.2-.6 1.7-1l2.3.6 2-3.5-1.9-1.5Z"/></S>
);
export const IconGraph = (p: P) => (
  <S {...p}><path d="M3 20h18"/><path d="M6 16v-6"/><path d="M12 20v-12"/><path d="M18 20v-9"/></S>
);
export const IconDoc = (p: P) => (
  <S {...p}><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v6h6"/></S>
);
export const IconBolt = (p: P) => (
  <S {...p}><path d="m11 21 1-7H8l5-11-1 7h4l-5 11Z"/></S>
);
export const IconPaint = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M12 22s8-4 8-10a8 8 0 1 0-16 0c0 6 8 10 8 10z" />
  </svg>
);
export const IconFolder = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M3 7h5l2 2h11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
export const IconCog = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15c0-.57-.22-1.11-.59-1.51l-.06-.06A2 2 0 1 1 7.18 10l.06.06c.4.36.94.59 1.51.59s1.11-.22 1.51-.59l.06-.06A2 2 0 1 1 16.76 10l-.06.06c-.36.4-.59.94-.59 1.51s.22 1.11.59 1.51z" />
  </svg>
);
export const IconKey = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <circle cx="7" cy="17" r="3" />
    <path d="M10 17h10l-2-2 2-2-2-2" />
  </svg>
);
export const IconFace = (p: any) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <circle cx="12" cy="12" r="9" /><path d="M9 10h.01M15 10h.01M8 15s1.5 2 4 2 4-2 4-2" />
  </svg>
);

export const IconChat = (p: P) => (
  <S {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></S>
);

export const IconBot = (p: P) => (
  <S {...p}><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h2a7 7 0 0 1 7 7v1a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-1a7 7 0 0 1 7-7h2V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><path d="M7.5 13a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0-5"/><path d="M16.5 13a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0-5"/></S>
);

export const IconWrench = (p: P) => (
  <S {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></S>
);