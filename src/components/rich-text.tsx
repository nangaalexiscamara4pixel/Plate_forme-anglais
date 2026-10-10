import type { ReactNode } from "react";
import { safeHref, type RichNode } from "@/features/content/rich-text";
import { cn } from "@/lib/utils";

/**
 * Rendu d'un document de texte riche en éléments React, nœud par nœud, depuis une liste
 * blanche. Aucun HTML brut n'est injecté : React échappe tout le texte, et les liens
 * sont revalidés (http/https/mailto uniquement) au moment du rendu.
 */
function renderText(node: RichNode, key: number): ReactNode {
  let el: ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        el = <strong>{el}</strong>;
        break;
      case "italic":
        el = <em>{el}</em>;
        break;
      case "underline":
        el = <u>{el}</u>;
        break;
      case "strike":
        el = <s>{el}</s>;
        break;
      case "code":
        el = <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{el}</code>;
        break;
      case "highlight":
        el = <mark className="rounded-sm bg-brand/30 px-0.5 text-inherit">{el}</mark>;
        break;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (href) {
          el = (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary underline underline-offset-4 dark:text-brand-ink">
              {el}
            </a>
          );
        }
        break;
      }
    }
  }
  return <span key={key}>{el}</span>;
}

function renderNode(node: RichNode, key: number): ReactNode {
  const children = node.content?.map((c, i) => renderNode(c, i));
  switch (node.type) {
    case "text":
      return renderText(node, key);
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading": {
      const level = node.attrs?.level ?? 2;
      return level === 3 ? <h3 key={key}>{children}</h3> : level === 4 ? <h4 key={key}>{children}</h4> : <h2 key={key}>{children}</h2>;
    }
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={node.attrs?.start}>
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table>
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children}</tr>;
    case "tableHeader":
      return (
        <th key={key} colSpan={node.attrs?.colspan} rowSpan={node.attrs?.rowspan} scope="col">
          {children}
        </th>
      );
    case "tableCell":
      return (
        <td key={key} colSpan={node.attrs?.colspan} rowSpan={node.attrs?.rowspan}>
          {children}
        </td>
      );
    default:
      return null; // type inconnu : jamais rendu
  }
}

export function RichText({ doc, className }: { doc: RichNode; className?: string }) {
  return <div className={cn("prose-academy", className)}>{doc.content?.map((n, i) => renderNode(n, i))}</div>;
}
