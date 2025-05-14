      // Check if user has permission (admins can edit any item, users can only edit their own)
      if (req.user && item.user && req.user.role !== 'admin' && item.user.toString() !== req.user._id.toString()) {
        console.log('Edit permission denied - User is not admin and not the owner');
        req.flash('error', 'You do not have permission to edit this item');
        return res.redirect(`/items/${item._id}`);
      }
      
      // Log permission granted
      console.log('Edit permission granted to:', req.user.email, 'Role:', req.user.role);
