export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-2">Room</h1>
      <p className="text-gray-400">Code : {code}</p>
    </main>
  )
}