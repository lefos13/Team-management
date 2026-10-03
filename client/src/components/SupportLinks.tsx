import { Anchor, Group, Text } from "@mantine/core";
import { IconBrandGithub, IconCoffee } from "@tabler/icons-react";
import { supportLinks } from "../data/support-links";

export function SupportLinks() {
  const githubLink = supportLinks.find((link) => link.id === "github-sponsors");
  const coffeeLink = supportLinks.find((link) => link.id === "buy-me-a-coffee");

  return (
    <>
      <Text fw={800} c="teal.3" size="sm">
        Enjoying MGteam?
      </Text>
      <Text size="xs" c="blue.1" lh={1.35}>
        Help keep it free and improving.
      </Text>
      <Group gap={6} mt={2} wrap="wrap">
        {githubLink ? (
          <Anchor
            href={githubLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shell-support-link"
          >
            <IconBrandGithub size={13} />
            <span>Sponsor</span>
          </Anchor>
        ) : null}
        {coffeeLink ? (
          <Anchor
            href={coffeeLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shell-support-link"
          >
            <IconCoffee size={13} />
            <span>Buy a coffee</span>
          </Anchor>
        ) : null}
      </Group>
    </>
  );
}
