import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { CustomVideoPlayer, type VideoPlaylistItem } from "@/components/media/custom-video-player";

const demoPlaylist: VideoPlaylistItem[] = [
  {
    id: "intro",
    title: "Knowlense onboarding overview",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    description: "A short demo clip that represents the first product walkthrough.",
    durationLabel: "0:30"
  },
  {
    id: "research-flow",
    title: "Research workflow walkthrough",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
    description: "Use this item to verify resume, keyboard shortcuts, and playlist switching.",
    durationLabel: "0:30"
  },
  {
    id: "extension-connect",
    title: "Extension connection guide",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    description: "A third item for validating per-video progress storage in localStorage.",
    durationLabel: "0:30"
  }
];

export default function VideoPlayerDemoPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="Video player demo"
        navItems={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/pricing", label: "Pricing" },
          { href: "/account", label: "Account" }
        ]}
      />

      <section className="shell marketing-surface">
        <CustomVideoPlayer initialVideoId="intro" playlist={demoPlaylist} title="Custom video player" />
      </section>

      <SiteFooter />
    </main>
  );
}
