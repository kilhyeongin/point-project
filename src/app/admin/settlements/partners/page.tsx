"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    const res = await fetch("/api/admin/settlements/summary");
    const data = await res.json();
    setItems(data.items || []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>
        PARTNER 정산
      </h1>

      {items.map((r, i) => (
        <div
          key={i}
          style={{
            borderBottom: "1px solid #eee",
            padding: 10,
          }}
        >
          PARTNER {r._id.partnerId}  

          <b>{Number(r.total).toLocaleString()}P</b>
        </div>
      ))}
    </main>
  );
}