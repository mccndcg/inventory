const legacyDatabaseName = "goods";

interface DatabaseDescriptor {
  name?: string;
  version?: number;
}

interface LegacyEntry {
  key: IDBValidKey;
  primaryKey: IDBValidKey;
  value: unknown;
}

interface LegacyStoreArchive {
  name: string;
  entries: LegacyEntry[];
}

export interface LegacyDatabaseArchive {
  format: "inventory-legacy-indexeddb-export";
  formatVersion: 1;
  exportedAt: string;
  source: {
    databaseName: string;
    databaseVersion: number;
  };
  stores: LegacyStoreArchive[];
}

function openExistingDatabase(
  factory: IDBFactory,
  databaseName: string,
  databaseVersion: number,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error ?? new Error("Could not open the legacy database."));
    };
    request.onblocked = () => {
      reject(new Error("Close other inventory tabs before exporting."));
    };
  });
}

function readStore(
  database: IDBDatabase,
  storeName: string,
): Promise<LegacyStoreArchive> {
  return new Promise((resolve, reject) => {
    const entries: LegacyEntry[] = [];
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).openCursor();

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        return;
      }

      entries.push({
        key: cursor.key,
        primaryKey: cursor.primaryKey,
        value: cursor.value,
      });
      cursor.continue();
    };
    request.onerror = () => {
      reject(request.error ?? new Error(`Could not read ${storeName}.`));
    };
    transaction.oncomplete = () => resolve({ name: storeName, entries });
    transaction.onabort = () => {
      reject(transaction.error ?? new Error(`Export of ${storeName} was aborted.`));
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error(`Could not export ${storeName}.`));
    };
  });
}

export async function exportLegacyDatabase(
  providedFactory: IDBFactory = indexedDB,
): Promise<LegacyDatabaseArchive | null> {
  const factory = providedFactory as IDBFactory & {
    databases?: () => Promise<DatabaseDescriptor[]>;
  };

  if (typeof factory.databases !== "function") {
    throw new Error(
      "This browser cannot safely discover an existing IndexedDB database.",
    );
  }

  const descriptor = (await factory.databases())
    .find(({ name }) => name === legacyDatabaseName);

  if (!descriptor?.version) {
    return null;
  }

  const database = await openExistingDatabase(
    factory,
    legacyDatabaseName,
    descriptor.version,
  );

  try {
    const stores = await Promise.all(
      [...database.objectStoreNames].map((storeName) =>
        readStore(database, storeName)),
    );

    return {
      format: "inventory-legacy-indexeddb-export",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      source: {
        databaseName: legacyDatabaseName,
        databaseVersion: database.version,
      },
      stores,
    };
  } finally {
    database.close();
  }
}

export function downloadLegacyArchive(archive: LegacyDatabaseArchive): void {
  const payload = JSON.stringify(archive, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const timestamp = archive.exportedAt.replaceAll(":", "-");

  anchor.href = url;
  anchor.download = `inventory-legacy-${timestamp}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
