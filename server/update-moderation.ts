import { db } from '../db';
import { posts, comments } from '../shared/schema';
import { isNull, eq } from 'drizzle-orm';
import { checkContentModeration } from './huggingface';

async function updateAllPostsModeration() {
  console.log('Starting moderation check for all posts...');
  
  // Get all posts (we'll update all of them)
  const postsToCheck = await db
    .select()
    .from(posts);

  console.log(`Found ${postsToCheck.length} posts to check`);

  for (const post of postsToCheck) {
    try {
      console.log(`Checking post: ${post.id} - ${post.title}`);
      
      const contentToCheck = `${post.title}\n${post.content}`;
      const moderation = await checkContentModeration(contentToCheck);
      
      await db
        .update(posts)
        .set({
          moderationScore: moderation.moderationScore,
          isFlagged: moderation.isFlagged,
          moderationReason: moderation.moderationReason,
        })
        .where(eq(posts.id, post.id));
      
      console.log(`✓ Updated post ${post.id}: ${moderation.isFlagged ? 'FLAGGED' : 'SAFE'} (${(parseFloat(moderation.moderationScore) * 100).toFixed(1)}%)`);
      
      // Wait a bit between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`✗ Failed to check post ${post.id}:`, error);
    }
  }
  
  console.log('Posts moderation check completed!');
}

async function updateAllCommentsModeration() {
  console.log('\nStarting moderation check for all comments...');
  
  // Get all comments
  const commentsToCheck = await db
    .select()
    .from(comments);

  console.log(`Found ${commentsToCheck.length} comments to check`);

  for (const comment of commentsToCheck) {
    try {
      console.log(`Checking comment: ${comment.id}`);
      
      const moderation = await checkContentModeration(comment.content);
      
      await db
        .update(comments)
        .set({
          moderationScore: moderation.moderationScore,
          isFlagged: moderation.isFlagged,
          moderationReason: moderation.moderationReason,
        })
        .where(eq(comments.id, comment.id));
      
      console.log(`✓ Updated comment ${comment.id}: ${moderation.isFlagged ? 'FLAGGED' : 'SAFE'} (${(parseFloat(moderation.moderationScore) * 100).toFixed(1)}%)`);
      
      // Wait a bit between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`✗ Failed to check comment ${comment.id}:`, error);
    }
  }
  
  console.log('Comments moderation check completed!');
}

async function updateAllModeration() {
  console.log('========================================');
  console.log('Content Moderation Update Script');
  console.log('========================================\n');
  
  await updateAllPostsModeration();
  await updateAllCommentsModeration();
  
  console.log('\n========================================');
  console.log('All moderation checks completed!');
  console.log('========================================');
}

updateAllModeration()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
