import prisma from './src/db';

async function main() {
  console.log("Searching for project containing 'secret trick'...");

  const project = await prisma.project.findFirst({
    where: { topic: { contains: "secret trick" } },
    include: { script: true }
  });
  if (!project) {
    console.log('No project found containing "secret trick"');
    return;
  }
  if (!project.script) {
    console.log(`Found project ${project.id} but it has no script!`);
    return;
  }

  const payload = {
    title: project.script.title,
    youtubeTitle: project.script.youtubeTitle,
    youtubeDescription: project.script.youtubeDescription,
    hook: project.script.hook,
    body: project.script.body,
    cta: project.script.cta,
    duration: project.script.duration
  };

  console.log(`Triggering script regeneration for project ${project.id}...`);
  const response = await fetch(`http://localhost:3001/api/projects/${project.id}/script`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  console.log('Response:', resJson);

  // Poll project status from the database
  console.log('Polling project status...');
  let currentProject = project;
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const p = await prisma.project.findUnique({
      where: { id: project.id },
      include: { script: true, scenes: { orderBy: { sequenceNumber: 'asc' } } }
    });
    if (!p) {
      console.log('Project disappeared!');
      return;
    }
    if (p.status !== 'GENERATING_SCENES' && p.status !== 'GENERATING_AUDIO' && p.status !== 'GENERATING_IMAGES' && p.status !== 'SCORING') {
      currentProject = p as any;
      console.log(`Finished polling. Status is now: ${p.status}`);
      if (p.error) {
        console.error('Error during generation:', p.error);
      }
      break;
    }
    console.log(`Status: ${p.status} | Scenes count: ${p.scenes.length}`);
  }

  console.log(`Project ID: ${currentProject.id}`);
  console.log(`Total Scenes: ${currentProject.scenes.length}`);
  console.log('Final Scenes:');
  for (const scene of currentProject.scenes) {
    const data = JSON.parse(scene.templateData);
    console.log(`- Scene ${scene.sequenceNumber}: Speaker: ${data.storyState?.speaker} | Text: "${scene.text}" | isIntro: ${data.isIntro} | imageUrl: ${data.imageUrl}`);
  }
}

main().catch(console.error);
