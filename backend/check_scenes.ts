import prisma from './src/db';

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: 'b86515a8-1b06-4cc8-9ca3-4fa36f1b5651' },
    include: { script: true, scenes: { orderBy: { sequenceNumber: 'asc' } } }
  });
  if (!project) {
    console.log('Project not found');
    return;
  }
  console.log('Script Title:', project.script?.title);
  console.log('Script Hook:', project.script?.hook);
  console.log('Script Body:', project.script?.body);
  console.log('Script CTA:', project.script?.cta);
  console.log('Scenes count:', project.scenes.length);
  project.scenes.forEach(s => {
    console.log(`- Scene ${s.sequenceNumber}: [${s.template}] "${s.text}"`);
    console.log(`  Audio Path: ${s.audioPath}`);
    console.log(`  Duration: ${s.duration}s`);
  });
}

main().catch(console.error);
