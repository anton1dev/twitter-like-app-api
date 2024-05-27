import { Inject, Injectable } from '@nestjs/common';
import { PostDocument } from './post.document';
import { CollectionReference } from '@google-cloud/firestore';
import { UpdatePostDto } from './dto/update-post.dto';
import { query, where } from 'firebase/firestore';
@Injectable()
export class PostRepository {
  constructor(
    @Inject(PostDocument.collectionName)
    private postCollection: CollectionReference<PostDocument>,
  ) {}

  async getAll(
    page: string = '1',
    limit: string = '20',
  ): Promise<PostDocument[]> {
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const startsAt = (pageNumber - 1) * limitNumber;

    const snapshot = await this.postCollection
      .orderBy('createdAt')
      .offset(startsAt)
      .limit(limitNumber)
      .get();
    return snapshot.docs.map((post) => ({ id: post.id, ...post.data() }));
  }

  async getAllByUserId(userId: string): Promise<PostDocument[]> {
    const snapshot = await this.postCollection
      .where('authorId', '==', userId)
      .get();

    return snapshot.docs.map((post) => ({ id: post.id, ...post.data() }));
  }

  async getOneByPostId(postId: string): Promise<PostDocument> {
    return (await this.postCollection.doc(postId).get()).data();
  }

  async getPostsFromSearchQuery(searchQuery: string): Promise<PostDocument[]> {
    const postsSnapshot = await this.postCollection.get();

    if (postsSnapshot.empty) {
      return [];
    }

    const postsWithSearchedQuery = postsSnapshot.docs.filter(
      (post) =>
        post.data().title.toLowerCase().includes(searchQuery) ||
        post.data().text.toLowerCase().includes(searchQuery),
    );

    return postsWithSearchedQuery.map((post) => ({
      id: post.id,
      ...post.data(),
    }));
  }

  async create(newPost: Omit<PostDocument, 'id'>): Promise<PostDocument> {
    const postRef = await this.postCollection.add(newPost as PostDocument);

    return {
      id: postRef.id,
      ...newPost,
    };
  }

  async update(postId: string, updatePostDto: UpdatePostDto): Promise<void> {
    const updatedPost = {
      ...updatePostDto,
    };

    await this.postCollection.doc(postId).update(updatedPost);
  }

  async delete(postId: string): Promise<void> {
    await this.postCollection.doc(postId).delete();
  }

  async updateLikesScore(postId: string): Promise<number> {
    const post = (await this.postCollection.doc(postId).get()).data();

    const likesCount = post.likes ? post.likes.length : 0;
    const dislikesCount = post.dislikes ? post.dislikes.length : 0;
    const likesScore = likesCount - dislikesCount;

    await this.postCollection.doc(postId).update({ likesScore });
    return likesScore;
  }

  async addLike(postId: string, userId: string): Promise<void> {
    const prevLikes = (await this.postCollection.doc(postId).get()).data()
      .likes;
    prevLikes.push(userId);

    await this.postCollection.doc(postId).update({ likes: prevLikes });

    await this.updateLikesScore(postId);
  }

  async removeLike(postId: string, userId: string): Promise<void> {
    const prevLikes = (await this.postCollection.doc(postId).get()).data()
      .likes;
    const filteredLikes = prevLikes.filter((like) => like !== userId);

    await this.postCollection.doc(postId).update({ likes: filteredLikes });

    await this.updateLikesScore(postId);
  }

  async addDislike(postId: string, userId: string): Promise<void> {
    const prevDislikes = (await this.postCollection.doc(postId).get()).data()
      .dislikes;
    prevDislikes.push(userId);

    await this.postCollection.doc(postId).update({ dislikes: prevDislikes });
    await this.updateLikesScore(postId);
  }

  async removeDislike(postId: string, userId: string): Promise<void> {
    const prevDislikes = (await this.postCollection.doc(postId).get()).data()
      .dislikes;
    const filteredDislikes = prevDislikes.filter((like) => like !== userId);

    await this.postCollection
      .doc(postId)
      .update({ dislikes: filteredDislikes });

    await this.updateLikesScore(postId);
  }
}
