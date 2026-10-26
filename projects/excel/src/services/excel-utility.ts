import { Workbook } from "igniteui-react-excel";

/**
 * Downloads an .xlsx file and parses it into a {@link Workbook}.
 * Aborting the signal cancels the download; a parse that is already running still completes.
 */
export function loadWorkbook(url: string, signal?: AbortSignal): Promise<Workbook> {
  return fetch(url, { signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Fetching "${url}" failed with status ${response.status}.`);
      }

      return response.arrayBuffer();
    })
    .then(
      (buffer) =>
        new Promise<Workbook>((resolve, reject) => {
          Workbook.load(new Uint8Array(buffer), resolve, reject);
        })
    );
}
