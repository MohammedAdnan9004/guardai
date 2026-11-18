"use client";

import { motion } from "framer-motion";
import { Check, Circle } from "lucide-react";
import { evaluatePasswordStrength } from "@/lib/security/validation";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  password: string;
  showRules?: boolean;
}

export function PasswordStrengthMeter({
  password,
  showRules = true,
}: PasswordStrengthMeterProps) {
  const result = evaluatePasswordStrength(password);

  const colorMap: Record<number, string> = {
    0: "bg-muted",
    1: "bg-rose-500",
    2: "bg-orange-500",
    3: "bg-amber-500",
    4: "bg-sky-500",
    5: "bg-emerald-500",
  };

  const textMap: Record<number, string> = {
    0: "text-muted-foreground",
    1: "text-rose-500",
    2: "text-orange-500",
    3: "text-amber-500",
    4: "text-sky-500",
    5: "text-emerald-500",
  };

  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">
          Cryptographic Entropy
        </span>
        <span className={cn("font-mono font-semibold", textMap[result.score])}>
          {password.length === 0 ? "Awaiting input" : result.label} ({result.score}/5)
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((segment) => {
          const active = result.score >= segment;
          return (
            <div
              key={segment}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <motion.div
                initial={false}
                animate={{
                  width: active ? "100%" : "0%",
                }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn("h-full rounded-full", colorMap[result.score])}
              />
            </div>
          );
        })}
      </div>

      {showRules && (
        <div className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2">
          {result.checks.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                rule.passed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              )}
            >
              {rule.passed ? (
                <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />
              ) : (
                <Circle className="h-3 w-3 shrink-0 opacity-50" />
              )}
              <span>{rule.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
