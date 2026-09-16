export default async function TestFooPage({ params }: { params: Promise<{ foo: string }> }) {
  const { foo } = await params;
  return <div>Test dynamic route: {foo}</div>;
}
