"use client";

import { useEffect, useState } from "react";
import { Bot, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import type { AgentControls, AgentEventView } from "@/components/bridge/types";

const SHOWN_EVENTS = 4;

/** "5 min", "2 h", "3 d" en el idioma de la app. */
export function relativeTime(at: number, now: number, lang: "es" | "en"): string | null {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return lang === "es" ? `${days} d` : `${days}d`;
}

function EventRow({ event, now }: { event: AgentEventView; now: number }) {
  const { lang, t } = useLang();
  const ago = relativeTime(event.createdAt, now, lang);
  return (
    <li className="flex flex-col gap-0.5 border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <p className="text-sm leading-snug">{event.message}</p>
      <p className="text-xs text-muted-foreground">
        {ago ? t.agent.ago(ago) : t.agent.justNow}
        {event.decidedBy === "agent" && <> · {t.agent.byAi}</>}
      </p>
    </li>
  );
}

/**
 * Tu agente: si está activo, lo último que hizo, "revisar ahora" y
 * apagarlo. Si está apagado, una línea de qué hace y un botón para
 * activarlo (abre el permiso).
 */
export function AgentCard({
  agent,
  hasRule,
  onEnable,
}: {
  agent: AgentControls;
  hasRule: boolean;
  onEnable: () => void;
}) {
  const { t } = useLang();
  const [running, setRunning] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  // La hora de referencia para "hace 5 min", que avanza sola cada minuto.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!agent.available) return null;

  const runNow = async () => {
    setRunning(true);
    try {
      await agent.runNow();
    } catch {
      // la bitácora dice lo que pasó
    } finally {
      setRunning(false);
    }
  };

  const turnOff = async () => {
    setTurningOff(true);
    try {
      await agent.disable();
    } finally {
      setTurningOff(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6" data-testid="agent-card">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="size-4 text-primary" aria-hidden="true" />
          {t.agent.title}
        </p>
        {agent.ready && (
          <Badge tone={agent.enabled ? "success" : "neutral"} data-testid="agent-state">
            {agent.enabled ? t.agent.on : t.agent.off}
          </Badge>
        )}
      </div>

      {!agent.ready ? (
        <Skeleton className="mt-3 h-16" />
      ) : agent.enabled ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{t.agent.onSub}</p>
          <p className="mt-4 text-xs font-medium text-muted-foreground">{t.agent.history}</p>
          {agent.events.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t.agent.empty}</p>
          ) : (
            <ul className="mt-2" data-testid="agent-events">
              {agent.events.slice(0, SHOWN_EVENTS).map((event) => (
                <EventRow key={event.id} event={event} now={now} />
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={runNow} loading={running} data-testid="agent-run">
              {!running && <RefreshCw className="size-4" aria-hidden="true" />}
              {running ? t.agent.running : t.agent.runNow}
            </Button>
            <Button variant="ghost" size="sm" onClick={turnOff} loading={turningOff} data-testid="agent-disable">
              {t.agent.disable}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{t.agent.offSub}</p>
          {hasRule ? (
            <Button variant="secondary" onClick={onEnable} className="mt-4 w-full" data-testid="agent-enable">
              <Bot className="size-4" aria-hidden="true" />
              {t.agent.enable}
            </Button>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">{t.agent.needsRule}</p>
          )}
        </>
      )}
    </Card>
  );
}
