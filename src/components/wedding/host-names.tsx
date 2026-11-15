import { hostNameParts } from "./format";

/**
 * Host Display Names with a styled conjunction. The text content stays the
 * natural sentence ("Alex and Sam"), so the accessible name is unchanged.
 */
export function HostNames({ names }: { names: string[] }) {
  return (
    <>
      {hostNameParts(names).map((part, index) => (
        <span
          key={index}
          className={
            part.type === "name" ? "wedding-names__name" : "wedding-names__join"
          }
        >
          {part.value}
        </span>
      ))}
    </>
  );
}

export function hostNamesClass(names: string[]): string {
  return names.length === 2
    ? "wedding-names wedding-names--pair"
    : "wedding-names";
}
