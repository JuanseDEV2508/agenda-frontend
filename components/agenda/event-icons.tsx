"use client";

import {
  Briefcase,
  Calendar,
  CalendarSync,
  CheckCheck,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Home,
  Lock,
  Palmtree,
  Phone,
  PlayCircle,
  Users,
  UserX,
  Utensils,
} from "lucide-react";

import type { EventStatus, EventType } from "@/features/agenda/types";

/**
 * Iconos de tipo y estado.
 *
 * Se resuelven con un `switch` que devuelve directamente el elemento JSX, en
 * lugar de seleccionar un componente en tiempo de ejecución: así los iconos son
 * referencias estáticas (tree-shaking correcto y sin componentes creados
 * durante el render).
 */

export function EventTypeIcon({
  eventType,
  className,
}: {
  eventType: EventType | null;
  className?: string;
}) {
  switch (eventType) {
    case "PROPERTY_VISIT":
      return <Home className={className} aria-hidden="true" />;
    case "CLIENT_MEETING":
      return <Users className={className} aria-hidden="true" />;
    case "PHONE_CALL":
      return <Phone className={className} aria-hidden="true" />;
    case "INTERNAL_MEETING":
      return <Briefcase className={className} aria-hidden="true" />;
    case "PERSONAL_BLOCK":
      return <Lock className={className} aria-hidden="true" />;
    case "LUNCH":
      return <Utensils className={className} aria-hidden="true" />;
    case "VACATION":
      return <Palmtree className={className} aria-hidden="true" />;
    default:
      return <Calendar className={className} aria-hidden="true" />;
  }
}

export function EventStatusIcon({
  status,
  className,
}: {
  status: EventStatus | null;
  className?: string;
}) {
  switch (status) {
    case "PENDING":
      return <Clock className={className} aria-hidden="true" />;
    case "CONFIRMED":
      return <CircleCheck className={className} aria-hidden="true" />;
    case "IN_PROGRESS":
      return <PlayCircle className={className} aria-hidden="true" />;
    case "COMPLETED":
      return <CheckCheck className={className} aria-hidden="true" />;
    case "CANCELLED":
      return <CircleX className={className} aria-hidden="true" />;
    case "NO_SHOW":
      return <UserX className={className} aria-hidden="true" />;
    case "RESCHEDULED":
      return <CalendarSync className={className} aria-hidden="true" />;
    default:
      return <CircleHelp className={className} aria-hidden="true" />;
  }
}
