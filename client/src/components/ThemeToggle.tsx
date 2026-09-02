import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
  type ActionIconProps,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";

export interface ThemeToggleProps extends Omit<ActionIconProps, "onClick" | "children"> {
  className?: string;
}

export function ThemeToggle({
  className = "",
  size = "lg",
  variant = "default",
  ...others
}: ThemeToggleProps) {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const isDark = computedColorScheme === "dark";

  return (
    <Tooltip label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <ActionIcon
        onClick={() => setColorScheme(isDark ? "light" : "dark")}
        variant={variant}
        size={size}
        aria-label="Toggle color scheme"
        className={`theme-toggle-btn ${className}`.trim()}
        {...others}
      >
        {isDark ? (
          <IconSun size={18} stroke={1.5} />
        ) : (
          <IconMoon size={18} stroke={1.5} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
