import { HostNames } from "./host-names";
import { Flourish } from "./ornaments";

/** Quiet closing treatment; it repeats Host Display Names and adds no content. */
export function WeddingFooter({ hostNames }: { hostNames: string[] }) {
  return (
    <footer className="wedding-footer">
      <div className="wedding-shell">
        <div data-reveal="fade">
          <Flourish />
        </div>
        <p className="wedding-label" data-reveal="up" data-reveal-delay="1">
          With love
        </p>
        <p
          className="wedding-footer__names"
          data-reveal="up"
          data-reveal-delay="2"
        >
          <HostNames names={hostNames} />
        </p>
      </div>
    </footer>
  );
}
