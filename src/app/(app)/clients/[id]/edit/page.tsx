import { requireBusiness } from "@/lib/session";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateClient } from "@/lib/actions/clients";
import { ClientForm } from "../../client-form";
import Link from "next/link";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.businessId, business.id)),
  });
  if (!client) notFound();

  const updateWithId = updateClient.bind(null, id);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <Link href={`/clients/${id}`} className="text-sm text-gray-500 hover:underline">
        ← {client.name}
      </Link>
      <h1 className="text-2xl font-bold mt-1 mb-8">Edit client</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <ClientForm action={updateWithId} client={client} />
      </div>
    </div>
  );
}
